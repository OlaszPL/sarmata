export {
  AI_PORT,
  answersSchema,
  CONTAINER_AI_HOST,
  installConfigSchema,
  isHostName,
  NATIVE_AI_BIND,
  publicUrls,
  type AiSettings,
  type Answers,
  type EnabledAi,
  type InstallConfig,
  type PublicUrls,
} from './config.ts';
export {
  PROFILE_TABLE,
  supabaseServicesOf,
  usesCaddy,
  type Exposure,
  type ProfileSpec,
} from './profiles.ts';
export {
  generateSecrets,
  parseEnv,
  readSecrets,
  renderEnv,
  secretsFromAnswers,
  type GeneratedSecrets,
  type RandomBytes,
  type Secrets,
} from './secrets.ts';

export {
  APP_IMAGES,
  composeServicesFor,
  composeVariables,
  renderCompose,
  type AppImage,
} from './compose.ts';
export { renderCaddyfile } from './caddy.ts';
export { renderBootstrapSql, type BootstrapAccount } from './bootstrap-sql.ts';

export {
  describePlan,
  usesTerminal,
  type Action,
  type Plan,
  type Step,
  type Target,
} from './plan.ts';
export { localHost, wslHost, type Host } from './host.ts';
export { executePlan, type ExecutionEvent, type ExecutionResult, type Hosts } from './execute.ts';

export {
  binaryName,
  detectEnvironment,
  layout,
  MIRRORED_NETWORKING_BUILD,
  WSL_DISTRO,
  type EngineStatus,
  type Environment,
  type Layout,
  type LinuxDistro,
  type ProcessFacts,
} from './environment.ts';
export { dockerCliConfigWithPlugins, prepareEngine, wslConfigNote } from './engine.ts';
export { desktopShortcut, type Shortcut } from './shortcut.ts';

export {
  aiRelayPorts,
  compareVersions,
  ENGINE_STOPPED,
  NOT_INSTALLED,
  planAiApply,
  planInstall,
  planRestore,
  planStageSource,
  planStart,
  planStatus,
  planStop,
  planUninstall,
  planUpdate,
  withoutAi,
  type AiApplyInput,
  type InstallInput,
  type UpdateInput,
  type UpdateSource,
} from './plans.ts';
export {
  applyStagedUpdate,
  handoverPlan,
  launcherAfterUpdate,
  stageUpdate,
  type StageOutcome,
} from './update.ts';

export {
  aiDataDir,
  aiServicePlan,
  aiServiceRemovalPlan,
  aiSettings,
  aiUnsupportedReason,
  installDecisionRuntime,
  installTextRuntime,
  proposeAi,
  uvInstall,
  UV_INSTALLER,
  type AiServiceId,
  type ServiceCommand,
} from './ai.ts';
export { setUpAi, type AiInstaller, type AiProbes, type AiSetupDeps } from './ai-setup.ts';
