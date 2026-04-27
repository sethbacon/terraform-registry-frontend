import { describe, it, expect } from 'vitest'
import {
  buildSourceExample,
  buildRequiredInputsExample,
  hasRequiredInputs,
  formatTerraformDefault,
} from '../terraformExample'
import type { ModuleInputVar } from '../../types'

const base = {
  registryHost: 'registry.example.com',
  namespace: 'hashicorp',
  name: 'vpc',
  system: 'aws',
  version: '1.2.3',
}

describe('terraformExample', () => {
  describe('buildSourceExample', () => {
    it('emits a minimal module block with pinned major.minor version', () => {
      expect(buildSourceExample(base)).toBe(
        'module "vpc" {\n  source  = "registry.example.com/hashicorp/vpc/aws"\n  version = ">=1.2"\n}',
      )
    })

    it('handles single-digit versions', () => {
      expect(buildSourceExample({ ...base, version: '1' })).toContain('version = ">=1"')
    })
  })

  describe('buildRequiredInputsExample', () => {
    it('returns only the source block when no inputs are required', () => {
      const result = buildRequiredInputsExample({ ...base, inputs: [] })
      expect(result).not.toContain('# Required inputs')
      expect(result).toContain('source  =')
    })

    it('renders placeholders for required inputs with type hints', () => {
      const inputs: ModuleInputVar[] = [
        {
          name: 'region',
          type: 'string',
          description: 'AWS region',
          default: undefined,
          required: true,
        },
        { name: 'enabled', type: 'bool', description: '', default: undefined, required: true },
        { name: 'count', type: 'number', description: '', default: undefined, required: true },
        {
          name: 'subnets',
          type: 'list(string)',
          description: '',
          default: undefined,
          required: true,
        },
        { name: 'tags', type: 'map(string)', description: '', default: undefined, required: true },
        { name: 'skipped', type: 'string', description: '', default: 'eu-west-1', required: false },
      ]
      const result = buildRequiredInputsExample({ ...base, inputs })
      expect(result).toContain('# Required inputs')
      expect(result).toContain('# AWS region')
      expect(result).toContain('region = "" # type: string')
      expect(result).toContain('enabled = false # type: bool')
      expect(result).toContain('count = 0 # type: number')
      expect(result).toContain('subnets = [] # type: list(string)')
      expect(result).toContain('tags = {} # type: map(string)')
      expect(result).not.toContain('skipped')
    })
  })

  describe('hasRequiredInputs', () => {
    it('is false for null / empty / all-optional', () => {
      expect(hasRequiredInputs(null)).toBe(false)
      expect(hasRequiredInputs([])).toBe(false)
      expect(
        hasRequiredInputs([
          { name: 'a', type: 'string', description: '', default: 'x', required: false },
        ]),
      ).toBe(false)
    })

    it('is true when at least one input is required', () => {
      expect(
        hasRequiredInputs([
          { name: 'a', type: 'string', description: '', default: undefined, required: true },
        ]),
      ).toBe(true)
    })
  })

  describe('formatTerraformDefault', () => {
    it('formats strings with escaped quotes', () => {
      expect(formatTerraformDefault('string', 'he said "hi"')).toBe('"he said \\"hi\\""')
    })
    it('formats booleans and numbers as literals', () => {
      expect(formatTerraformDefault('bool', true)).toBe('true')
      expect(formatTerraformDefault('number', 42)).toBe('42')
    })
    it('serialises arrays and objects as JSON', () => {
      expect(formatTerraformDefault('list(string)', ['a', 'b'])).toBe('["a","b"]')
      expect(formatTerraformDefault('map(string)', { a: 'b' })).toBe('{"a":"b"}')
    })
    it('falls back to typed empty literals on null', () => {
      expect(formatTerraformDefault('any', null)).toBe('{}')
      expect(formatTerraformDefault('string', null)).toBe('""')
    })
  })
})
