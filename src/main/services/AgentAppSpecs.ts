import os from 'node:os';
import path from 'node:path';
import { mkdir, rm } from 'node:fs/promises';
import type { AgentAppKind } from '../../shared/models';

interface AgentAppSpec {
  kind: AgentAppKind;
  displayName: string;
  commandName: string;
  homeDirectoryName: string;
  homeEnvKey: string;
  defaultHomePath: () => string;
  isolatedEnvKeys: string[];
}

const AGENT_APP_SPECS: Record<AgentAppKind, AgentAppSpec> = {
  codex: {
    kind: 'codex',
    displayName: 'Codex',
    commandName: process.platform === 'win32' ? 'codex.cmd' : 'codex',
    homeDirectoryName: 'codex',
    homeEnvKey: 'CODEX_HOME',
    defaultHomePath: () => process.env.CODEX_HOME || path.join(os.homedir(), '.codex'),
    isolatedEnvKeys: [
      'openai_api_key',
      'openai_base_url',
      'openai_organization',
      'openai_project',
      'codex_access_token',
      'codex_home',
    ],
  },
  claude: {
    kind: 'claude',
    displayName: 'Claude',
    commandName: process.platform === 'win32' ? 'claude.cmd' : 'claude',
    homeDirectoryName: 'claude',
    homeEnvKey: 'CLAUDE_CONFIG_DIR',
    defaultHomePath: () => process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'),
    isolatedEnvKeys: ['anthropic_api_key', 'claude_config_dir'],
  },
};

const GLOBAL_ISOLATED_ENV_KEYS = new Set(
  Object.values(AGENT_APP_SPECS)
    .flatMap((spec) => spec.isolatedEnvKeys)
    .map((key) => key.toLowerCase()),
);

export function getAgentAppSpec(kind: AgentAppKind): AgentAppSpec {
  return AGENT_APP_SPECS[kind];
}

export function getAgentCommand(kind: AgentAppKind): string {
  return getAgentAppSpec(kind).commandName;
}

export function buildAgentHome(
  kind: AgentAppKind,
  sessionProfilesRoot: string,
  sessionProfileId: string,
): string {
  return path.join(
    sessionProfilesRoot,
    sessionProfileId,
    getAgentAppSpec(kind).homeDirectoryName,
  );
}

export async function ensureAgentHome(agentHome: string): Promise<void> {
  await mkdir(agentHome, { recursive: true });
}

export async function clearAgentHome(
  kind: AgentAppKind,
  sessionProfilesRoot: string,
  sessionProfileId: string,
): Promise<void> {
  const resolvedRoot = path.resolve(sessionProfilesRoot);
  const agentHome = path.resolve(buildAgentHome(kind, sessionProfilesRoot, sessionProfileId));
  const rootWithSeparator = resolvedRoot.endsWith(path.sep)
    ? resolvedRoot
    : `${resolvedRoot}${path.sep}`;

  if (!agentHome.startsWith(rootWithSeparator)) {
    throw new Error(`Refusing to clear ${getAgentAppSpec(kind).homeEnvKey} outside the profile root.`);
  }

  await rm(agentHome, { recursive: true, force: true });
}

export function buildIsolatedAgentEnv(
  kind: AgentAppKind,
  agentHome: string,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  const spec = getAgentAppSpec(kind);

  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined || GLOBAL_ISOLATED_ENV_KEYS.has(key.toLowerCase())) {
      continue;
    }

    env[key] = value;
  }

  env[spec.homeEnvKey] = agentHome;
  env.TERM = env.TERM ?? 'xterm-256color';
  env.COLORTERM = env.COLORTERM ?? 'truecolor';
  return env;
}

export function getDefaultAgentHome(kind: AgentAppKind): string {
  return getAgentAppSpec(kind).defaultHomePath();
}
