/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

import { RunsFilter, RunStatus } from "./../../types/globalTypes";

// ====================================================
// GraphQL query operation: RunsRootQuery
// ====================================================

export interface RunsRootQuery_pipelineRunsOrError_Runs_results_repositoryOrigin {
  __typename: "RepositoryOrigin";
  id: string;
  repositoryName: string;
  repositoryLocationName: string;
}

export interface RunsRootQuery_pipelineRunsOrError_Runs_results_tags {
  __typename: "PipelineTag";
  key: string;
  value: string;
}

export interface RunsRootQuery_pipelineRunsOrError_Runs_results {
  __typename: "Run";
  id: string;
  runId: string;
  status: RunStatus;
  stepKeysToExecute: string[] | null;
  canTerminate: boolean;
  mode: string;
  rootRunId: string | null;
  parentRunId: string | null;
  pipelineSnapshotId: string | null;
  pipelineName: string;
  repositoryOrigin: RunsRootQuery_pipelineRunsOrError_Runs_results_repositoryOrigin | null;
  solidSelection: string[] | null;
  tags: RunsRootQuery_pipelineRunsOrError_Runs_results_tags[];
  startTime: number | null;
  endTime: number | null;
  updateTime: number | null;
}

export interface RunsRootQuery_pipelineRunsOrError_Runs {
  __typename: "Runs";
  results: RunsRootQuery_pipelineRunsOrError_Runs_results[];
}

export interface RunsRootQuery_pipelineRunsOrError_InvalidPipelineRunsFilterError {
  __typename: "InvalidPipelineRunsFilterError";
  message: string;
}

export interface RunsRootQuery_pipelineRunsOrError_PythonError_cause {
  __typename: "PythonError";
  message: string;
  stack: string[];
}

export interface RunsRootQuery_pipelineRunsOrError_PythonError {
  __typename: "PythonError";
  message: string;
  stack: string[];
  cause: RunsRootQuery_pipelineRunsOrError_PythonError_cause | null;
}

export type RunsRootQuery_pipelineRunsOrError = RunsRootQuery_pipelineRunsOrError_Runs | RunsRootQuery_pipelineRunsOrError_InvalidPipelineRunsFilterError | RunsRootQuery_pipelineRunsOrError_PythonError;

export interface RunsRootQuery_queuedCount_InvalidPipelineRunsFilterError {
  __typename: "InvalidPipelineRunsFilterError" | "PythonError";
}

export interface RunsRootQuery_queuedCount_Runs {
  __typename: "Runs";
  count: number | null;
}

export type RunsRootQuery_queuedCount = RunsRootQuery_queuedCount_InvalidPipelineRunsFilterError | RunsRootQuery_queuedCount_Runs;

export interface RunsRootQuery_inProgressCount_InvalidPipelineRunsFilterError {
  __typename: "InvalidPipelineRunsFilterError" | "PythonError";
}

export interface RunsRootQuery_inProgressCount_Runs {
  __typename: "Runs";
  count: number | null;
}

export type RunsRootQuery_inProgressCount = RunsRootQuery_inProgressCount_InvalidPipelineRunsFilterError | RunsRootQuery_inProgressCount_Runs;

export interface RunsRootQuery {
  pipelineRunsOrError: RunsRootQuery_pipelineRunsOrError;
  queuedCount: RunsRootQuery_queuedCount;
  inProgressCount: RunsRootQuery_inProgressCount;
}

export interface RunsRootQueryVariables {
  limit?: number | null;
  cursor?: string | null;
  filter: RunsFilter;
  queuedFilter: RunsFilter;
  inProgressFilter: RunsFilter;
}
