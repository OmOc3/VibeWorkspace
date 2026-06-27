import {
  buildAgentHome,
  buildIsolatedAgentEnv,
  clearAgentHome,
  ensureAgentHome,
  getAgentCommand,
} from './AgentAppSpecs';

export function getCodexCommand(): string {
  return getAgentCommand('codex');
}

export function buildCodexHome(sessionProfilesRoot: string, sessionProfileId: string): string {
  return buildAgentHome('codex', sessionProfilesRoot, sessionProfileId);
}

export async function ensureCodexHome(codexHome: string): Promise<void> {
  await ensureAgentHome(codexHome);
}

export async function clearCodexHome(
  sessionProfilesRoot: string,
  sessionProfileId: string,
): Promise<void> {
  await clearAgentHome('codex', sessionProfilesRoot, sessionProfileId);
}

export function buildIsolatedCodexEnv(codexHome: string): NodeJS.ProcessEnv {
  return buildIsolatedAgentEnv('codex', codexHome);
}
