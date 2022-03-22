import {gql, useQuery} from '@apollo/client';
import {Box} from '@dagster-io/ui';
import * as React from 'react';

import {PYTHON_ERROR_FRAGMENT} from '../app/PythonErrorInfo';
import {PipelineSelector} from '../types/globalTypes';
import {Loading} from '../ui/Loading';
import {isThisThingAJob, useRepository} from '../workspace/WorkspaceContext';
import {buildRepoAddress} from '../workspace/buildRepoAddress';

import {Description} from './Description';
import {NonIdealPipelineQueryResult} from './NonIdealPipelineQueryResult';
import {SidebarSection} from './SidebarComponents';
import {SidebarModeSection, SIDEBAR_MODE_INFO_FRAGMENT} from './SidebarModeSection';
import {
  JobOverviewSidebarQuery,
  JobOverviewSidebarQueryVariables,
} from './types/JobOverviewSidebarQuery';

export const SidebarPipelineOrJobOverview: React.FC<{
  pipelineSelector: PipelineSelector;
}> = ({pipelineSelector}) => {
  const queryResult = useQuery<JobOverviewSidebarQuery, JobOverviewSidebarQueryVariables>(
    JOB_OVERVIEW_SIDEBAR_QUERY,
    {
      fetchPolicy: 'cache-and-network',
      partialRefetch: true,
      variables: {pipelineSelector: pipelineSelector},
    },
  );

  const {repositoryName, repositoryLocationName} = pipelineSelector;
  const repo = useRepository(buildRepoAddress(repositoryName, repositoryLocationName));
  const isJob = isThisThingAJob(repo, pipelineSelector.pipelineName);

  return (
    <Loading queryResult={queryResult}>
      {({pipelineSnapshotOrError}) => {
        if (pipelineSnapshotOrError.__typename !== 'PipelineSnapshot') {
          return <NonIdealPipelineQueryResult isGraph={isJob} result={pipelineSnapshotOrError} />;
        }

        const modes = pipelineSnapshotOrError.modes;

        return (
          <>
            <SidebarSection title="Description">
              <Box padding={{vertical: 16, horizontal: 24}}>
                <Description
                  description={pipelineSnapshotOrError.description || 'No description provided'}
                />
              </Box>
            </SidebarSection>
            <SidebarSection title="Resources">
              <Box padding={{vertical: 16, horizontal: 24}}>
                {modes.map((mode) => (
                  <SidebarModeSection mode={mode} key={mode.name} />
                ))}
              </Box>
            </SidebarSection>
          </>
        );
      }}
    </Loading>
  );
};

const JOB_OVERVIEW_SIDEBAR_QUERY = gql`
  query JobOverviewSidebarQuery($pipelineSelector: PipelineSelector!) {
    pipelineSnapshotOrError(activePipelineSelector: $pipelineSelector) {
      ... on PipelineSnapshot {
        id
        name
        description
        modes {
          id
          ...SidebarModeInfoFragment
        }
      }
      ... on PipelineNotFoundError {
        message
      }
      ... on PipelineSnapshotNotFoundError {
        message
      }
      ...PythonErrorFragment
    }
  }
  ${SIDEBAR_MODE_INFO_FRAGMENT}
  ${PYTHON_ERROR_FRAGMENT}
`;
