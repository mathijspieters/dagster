import {gql, useApolloClient, useQuery} from '@apollo/client';
import {
  DialogWIP,
  DialogHeader,
  DialogBody,
  Box,
  Subheading,
  ButtonWIP,
  ButtonLink,
  DialogFooter,
  Alert,
} from '@dagster-io/ui';
import {pick, reject} from 'lodash';
import React from 'react';
import {useHistory} from 'react-router-dom';
import * as yaml from 'yaml';

import {showCustomAlert} from '../../app/CustomAlertProvider';
import {PythonErrorInfo, PYTHON_ERROR_FRAGMENT} from '../../app/PythonErrorInfo';
import {displayNameForAssetKey} from '../../app/Util';
import {PartitionHealthSummary, usePartitionHealthData} from '../../assets/PartitionHealthSummary';
import {AssetKey} from '../../assets/types';
import {CONFIG_PARTITION_SELECTION_QUERY} from '../../launchpad/ConfigEditorConfigPicker';
import {
  ConfigPartitionSelectionQuery,
  ConfigPartitionSelectionQueryVariables,
} from '../../launchpad/types/ConfigPartitionSelectionQuery';
import {
  assembleIntoSpans,
  PartitionRangeInput,
  stringForSpan,
} from '../../partitions/PartitionRangeInput';
import {
  LAUNCH_PARTITION_BACKFILL_MUTATION,
  showBackfillErrorToast,
  showBackfillSuccessToast,
} from '../../partitions/PartitionsBackfill';
import {
  LaunchPartitionBackfill,
  LaunchPartitionBackfillVariables,
} from '../../partitions/types/LaunchPartitionBackfill';
import {handleLaunchResult, LAUNCH_PIPELINE_EXECUTION_MUTATION} from '../../runs/RunUtils';
import {
  LaunchPipelineExecution,
  LaunchPipelineExecutionVariables,
} from '../../runs/types/LaunchPipelineExecution';
import {RepoAddress} from '../types';

import {RunningBackfillsNotice} from './RunningBackfillsNotice';
import {
  AssetJobPartitionSetsQuery,
  AssetJobPartitionSetsQueryVariables,
} from './types/AssetJobPartitionSetsQuery';

export const LaunchAssetChoosePartitionsDialog: React.FC<{
  open: boolean;
  setOpen: (open: boolean) => void;
  repoAddress: RepoAddress;
  assetJobName: string;
  assets: {assetKey: AssetKey; opName: string | null; partitionDefinition: string | null}[];
  upstreamAssetKeys: AssetKey[]; // single layer of upstream dependencies
}> = ({open, setOpen, assets, repoAddress, assetJobName, upstreamAssetKeys}) => {
  const data = usePartitionHealthData(assets.map((a) => a.assetKey));
  const upstreamData = usePartitionHealthData(upstreamAssetKeys);

  const allKeys = data[0] ? data[0].keys : [];
  const mostRecentKey = allKeys[allKeys.length - 1];

  const [selected, setSelected] = React.useState<string[]>([]);
  const [previewCount, setPreviewCount] = React.useState(4);
  const [launching, setLaunching] = React.useState(false);

  const setMostRecent = () => setSelected([mostRecentKey]);
  const setAll = () => setSelected([...allKeys]);
  const setMissing = () =>
    setSelected(allKeys.filter((key) => data.every((d) => !d.statusByPartition[key])));

  React.useEffect(() => {
    setSelected([mostRecentKey]);
  }, [mostRecentKey]);

  const title = `Launch runs to materialize ${
    assets.length > 1 ? `${assets.length} assets` : displayNameForAssetKey(assets[0].assetKey)
  }`;

  const client = useApolloClient();
  const history = useHistory();

  // Find the partition set name. This seems like a bit of a hack, unclear
  // how it would work if there were two different partition spaces in the asset job
  const {data: partitionSetsData} = useQuery<
    AssetJobPartitionSetsQuery,
    AssetJobPartitionSetsQueryVariables
  >(ASSET_JOB_PARTITION_SETS_QUERY, {
    skip: !open,
    variables: {
      repositoryLocationName: repoAddress.location,
      repositoryName: repoAddress.name,
      pipelineName: assetJobName,
    },
  });

  const partitionSet =
    partitionSetsData?.partitionSetsOrError.__typename === 'PartitionSets'
      ? partitionSetsData.partitionSetsOrError.results[0]
      : undefined;

  const onLaunch = async () => {
    setLaunching(true);

    if (!partitionSet) {
      const error =
        partitionSetsData?.partitionSetsOrError.__typename === 'PythonError'
          ? partitionSetsData.partitionSetsOrError
          : {message: 'No details provided.'};

      setLaunching(false);
      showCustomAlert({
        title: `Unable to find partition set on ${assetJobName}`,
        body: <PythonErrorInfo error={error} />,
      });
      return;
    }

    if (selected.length === 1) {
      const {data: tagAndConfigData} = await client.query<
        ConfigPartitionSelectionQuery,
        ConfigPartitionSelectionQueryVariables
      >({
        query: CONFIG_PARTITION_SELECTION_QUERY,
        variables: {
          repositorySelector: {
            repositoryLocationName: repoAddress.location,
            repositoryName: repoAddress.name,
          },
          partitionSetName: partitionSet.name,
          partitionName: selected[0],
        },
      });

      if (
        !tagAndConfigData ||
        !tagAndConfigData.partitionSetOrError ||
        tagAndConfigData.partitionSetOrError.__typename !== 'PartitionSet' ||
        !tagAndConfigData.partitionSetOrError.partition
      ) {
        return;
      }

      const {partition} = tagAndConfigData.partitionSetOrError;

      if (partition.tagsOrError.__typename === 'PythonError') {
        setLaunching(false);
        showCustomAlert({
          title: 'Unable to load tags',
          body: <PythonErrorInfo error={partition.tagsOrError} />,
        });
        return;
      }
      if (partition.runConfigOrError.__typename === 'PythonError') {
        setLaunching(false);
        showCustomAlert({
          title: 'Unable to load tags',
          body: <PythonErrorInfo error={partition.runConfigOrError} />,
        });
        return;
      }

      const tags = [...partition.tagsOrError.results];
      const runConfigData = yaml.parse(partition.runConfigOrError.yaml || '') || {};

      const launchResult = await client.mutate<
        LaunchPipelineExecution,
        LaunchPipelineExecutionVariables
      >({
        mutation: LAUNCH_PIPELINE_EXECUTION_MUTATION,
        variables: {
          executionParams: {
            runConfigData,
            mode: partition.mode,
            stepKeys: assets.map((a) => a.opName!),
            selector: {
              repositoryLocationName: repoAddress.location,
              repositoryName: repoAddress.name,
              jobName: assetJobName,
            },
            executionMetadata: {
              tags: tags.map((t) => pick(t, ['key', 'value'])),
            },
          },
        },
      });

      setLaunching(false);
      handleLaunchResult(assetJobName, launchResult, history, {behavior: 'toast'});

      if (launchResult.data?.launchPipelineExecution.__typename === 'LaunchRunSuccess') {
        setOpen(false);
      }
    } else {
      const {data: launchBackfillData} = await client.mutate<
        LaunchPartitionBackfill,
        LaunchPartitionBackfillVariables
      >({
        mutation: LAUNCH_PARTITION_BACKFILL_MUTATION,
        variables: {
          backfillParams: {
            selector: {
              partitionSetName: partitionSet.name,
              repositorySelector: {
                repositoryLocationName: repoAddress.location,
                repositoryName: repoAddress.name,
              },
            },
            partitionNames: selected,
            reexecutionSteps: assets.map((a) => a.opName!),
            fromFailure: false,
            tags: [],
          },
        },
      });

      setLaunching(false);

      if (launchBackfillData?.launchPartitionBackfill.__typename === 'LaunchBackfillSuccess') {
        showBackfillSuccessToast(history, launchBackfillData?.launchPartitionBackfill.backfillId);
        setOpen(false);
      } else {
        showBackfillErrorToast(launchBackfillData);
      }
    }
  };

  const upstreamUnavailable = (key: string) =>
    upstreamData.length > 0 &&
    upstreamData.some((a) => a.keys.includes(key) && !a.statusByPartition[key]);

  const upstreamUnavailableSpans = assembleIntoSpans(selected, upstreamUnavailable).filter(
    (s) => s.status === true,
  );
  const onRemoveUpstreamUnavailable = () => {
    setSelected(reject(selected, upstreamUnavailable));
  };

  return (
    <DialogWIP
      style={{width: 700}}
      isOpen={open}
      canEscapeKeyClose
      canOutsideClickClose
      onClose={() => setOpen(false)}
    >
      <DialogHeader icon="layers" label={title} />
      <DialogBody>
        <Box flex={{direction: 'column', gap: 8}}>
          <Subheading style={{flex: 1}}>Partition Keys</Subheading>
          <Box flex={{direction: 'row', gap: 8, alignItems: 'baseline'}}>
            <Box flex={{direction: 'column'}} style={{flex: 1}}>
              <PartitionRangeInput
                value={selected}
                onChange={setSelected}
                partitionNames={allKeys}
              />
            </Box>
            <ButtonWIP small onClick={setMostRecent}>
              Most Recent
            </ButtonWIP>
            <ButtonWIP small onClick={setMissing}>
              Missing
            </ButtonWIP>
            <ButtonWIP small onClick={setAll}>
              All
            </ButtonWIP>
          </Box>
        </Box>
        <Box
          flex={{direction: 'column', gap: 8}}
          style={{marginTop: 16, overflowY: 'auto', overflowX: 'visible', maxHeight: '50vh'}}
        >
          {assets.slice(0, previewCount).map((a) => (
            <PartitionHealthSummary
              assetKey={a.assetKey}
              showAssetKey
              key={displayNameForAssetKey(a.assetKey)}
              data={data}
              selected={selected}
            />
          ))}
          {previewCount < assets.length ? (
            <Box margin={{vertical: 8}}>
              <ButtonLink onClick={() => setPreviewCount(assets.length)}>
                Show {assets.length - previewCount} more previews
              </ButtonLink>
            </Box>
          ) : undefined}
        </Box>
        {upstreamUnavailableSpans.length > 0 && (
          <Box margin={{top: 16}}>
            <Alert
              intent="warning"
              title="Upstream Data Missing"
              description={
                <>
                  {upstreamUnavailableSpans.map((span) => stringForSpan(span, selected)).join(', ')}
                  {
                    ' cannot be materialized because upstream materializations are missing. Consider materializing upstream assets or '
                  }
                  <a onClick={onRemoveUpstreamUnavailable}>remove these partitions</a>
                  {` to avoid failures.`}
                </>
              }
            />
          </Box>
        )}
      </DialogBody>
      <DialogFooter
        left={partitionSet && <RunningBackfillsNotice partitionSetName={partitionSet.name} />}
      >
        <ButtonWIP intent="none" onClick={() => setOpen(false)}>
          Cancel
        </ButtonWIP>
        <ButtonWIP intent="primary" onClick={onLaunch}>
          {launching
            ? 'Launching...'
            : selected.length !== 1
            ? `Launch ${selected.length}-Run Backfill`
            : `Launch 1 Run`}
        </ButtonWIP>
      </DialogFooter>
    </DialogWIP>
  );
};

const ASSET_JOB_PARTITION_SETS_QUERY = gql`
  query AssetJobPartitionSetsQuery(
    $pipelineName: String!
    $repositoryName: String!
    $repositoryLocationName: String!
  ) {
    partitionSetsOrError(
      pipelineName: $pipelineName
      repositorySelector: {
        repositoryName: $repositoryName
        repositoryLocationName: $repositoryLocationName
      }
    ) {
      __typename
      ...PythonErrorFragment
      ... on PartitionSets {
        __typename
        results {
          id
          name
          mode
          solidSelection
        }
      }
    }
  }

  ${PYTHON_ERROR_FRAGMENT}
`;
