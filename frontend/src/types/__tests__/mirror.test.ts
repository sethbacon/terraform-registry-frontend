import { describe, it, expect } from 'vitest';
import { parseMirrorConfig } from '../mirror';
import type { MirrorConfiguration } from '../mirror';

const baseMirrorConfig: MirrorConfiguration = {
  id: '1',
  name: 'test-mirror',
  upstream_registry_url: 'https://registry.terraform.io',
  enabled: true,
  sync_interval_hours: 24,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('parseMirrorConfig', () => {
  it('returns empty arrays when filters are undefined', () => {
    const result = parseMirrorConfig(baseMirrorConfig);
    expect(result.namespaceFilters).toEqual([]);
    expect(result.providerFilters).toEqual([]);
    expect(result.platformFilters).toEqual([]);
  });

  it('parses valid JSON namespace filter', () => {
    const config: MirrorConfiguration = {
      ...baseMirrorConfig,
      namespace_filter: '["hashicorp","aws"]',
    };
    const result = parseMirrorConfig(config);
    expect(result.namespaceFilters).toEqual(['hashicorp', 'aws']);
  });

  it('parses valid JSON provider filter', () => {
    const config: MirrorConfiguration = {
      ...baseMirrorConfig,
      provider_filter: '["aws","azurerm"]',
    };
    const result = parseMirrorConfig(config);
    expect(result.providerFilters).toEqual(['aws', 'azurerm']);
  });

  it('parses valid JSON platform filter', () => {
    const config: MirrorConfiguration = {
      ...baseMirrorConfig,
      platform_filter: '["linux/amd64","darwin/arm64"]',
    };
    const result = parseMirrorConfig(config);
    expect(result.platformFilters).toEqual(['linux/amd64', 'darwin/arm64']);
  });

  it('returns empty arrays for malformed JSON', () => {
    const config: MirrorConfiguration = {
      ...baseMirrorConfig,
      namespace_filter: 'not-json',
      provider_filter: '{bad}',
      platform_filter: '[incomplete',
    };
    const result = parseMirrorConfig(config);
    expect(result.namespaceFilters).toEqual([]);
    expect(result.providerFilters).toEqual([]);
    expect(result.platformFilters).toEqual([]);
  });

  it('returns empty arrays for empty string filters', () => {
    const config: MirrorConfiguration = {
      ...baseMirrorConfig,
      namespace_filter: '',
      provider_filter: '',
      platform_filter: '',
    };
    const result = parseMirrorConfig(config);
    expect(result.namespaceFilters).toEqual([]);
    expect(result.providerFilters).toEqual([]);
    expect(result.platformFilters).toEqual([]);
  });

  it('spreads the original config onto the result', () => {
    const result = parseMirrorConfig(baseMirrorConfig);
    expect(result.id).toBe('1');
    expect(result.name).toBe('test-mirror');
    expect(result.upstream_registry_url).toBe('https://registry.terraform.io');
  });
});
