import type { Logger } from './Logger';

export interface SecretStore {
  getSecret(sessionProfileId: string, key: string): Promise<string | null>;
  setSecret(sessionProfileId: string, key: string, value: string): Promise<void>;
  deleteSecret(sessionProfileId: string, key: string): Promise<void>;
}

export class KeytarSecretStorePlaceholder implements SecretStore {
  constructor(private readonly logger: Logger) {}

  async getSecret(sessionProfileId: string, key: string): Promise<string | null> {
    this.logger.debug('Secret read skipped because auth is not implemented yet.', {
      sessionProfileId,
      key,
    });
    return null;
  }

  async setSecret(sessionProfileId: string, key: string, value: string): Promise<void> {
    void value;

    this.logger.debug('Secret write skipped because auth is not implemented yet.', {
      sessionProfileId,
      key,
    });
  }

  async deleteSecret(sessionProfileId: string, key: string): Promise<void> {
    this.logger.debug('Secret delete skipped because auth is not implemented yet.', {
      sessionProfileId,
      key,
    });
  }
}
