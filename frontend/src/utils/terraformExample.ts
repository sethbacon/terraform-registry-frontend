import type { ModuleInputVar } from '../types'

export interface BuildExampleOptions {
  registryHost: string
  namespace: string
  name: string
  system: string
  version: string
  inputs?: ModuleInputVar[] | null
  /** Whether the example is for terraform or opentofu. Currently identical syntax. */
  tool?: 'terraform' | 'opentofu'
}

/**
 * Formats a variable default value as a Terraform literal for the example
 * placeholder. Returns the Terraform expression as a string.
 */
export function formatTerraformDefault(type: string, def: unknown): string {
  const t = (type || '').trim().toLowerCase()

  if (def === null || def === undefined) {
    if (t.startsWith('list(') || t.startsWith('set(') || t.startsWith('tuple(')) return '[]'
    if (t.startsWith('map(') || t.startsWith('object(') || t === 'any') return '{}'
    if (t === 'bool') return 'false'
    if (t === 'number') return '0'
    return '""'
  }

  if (typeof def === 'string') {
    return `"${def.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  if (typeof def === 'boolean' || typeof def === 'number') {
    return String(def)
  }
  // Arrays / objects → compact JSON is a legal HCL literal for simple cases.
  try {
    return JSON.stringify(def)
  } catch {
    return '""'
  }
}

function buildSourceBlock(opts: BuildExampleOptions): string {
  const { registryHost, namespace, name, system, version } = opts
  const majorMinor = version.split('.').slice(0, 2).join('.')
  return `module "${name}" {
  source  = "${registryHost}/${namespace}/${name}/${system}"
  version = ">=${majorMinor}"
}`
}

/**
 * Builds a module block including commented placeholders for every required
 * input. Placeholders show the variable type and description when present.
 */
function buildWithRequiredInputs(opts: BuildExampleOptions): string {
  const { registryHost, namespace, name, system, version, inputs } = opts
  const majorMinor = version.split('.').slice(0, 2).join('.')
  const required = (inputs ?? []).filter((v) => v.required)

  const lines: string[] = [
    `module "${name}" {`,
    `  source  = "${registryHost}/${namespace}/${name}/${system}"`,
    `  version = ">=${majorMinor}"`,
  ]

  if (required.length > 0) {
    lines.push('')
    lines.push('  # Required inputs')
    for (const v of required) {
      if (v.description) {
        lines.push(`  # ${v.description.replace(/\s+/g, ' ').trim()}`)
      }
      const placeholder = formatTerraformDefault(v.type, null)
      lines.push(`  ${v.name} = ${placeholder} # type: ${v.type || 'any'}`)
    }
  }

  lines.push('}')
  return lines.join('\n')
}

/**
 * Returns the source-only module block (no placeholder inputs).
 */
export function buildSourceExample(opts: BuildExampleOptions): string {
  return buildSourceBlock(opts)
}

/**
 * Returns a module block with required-input placeholders commented inline.
 */
export function buildRequiredInputsExample(opts: BuildExampleOptions): string {
  return buildWithRequiredInputs(opts)
}

/**
 * True when the module has at least one required input and is worth showing a
 * second tab for.
 */
export function hasRequiredInputs(inputs?: ModuleInputVar[] | null): boolean {
  return !!inputs && inputs.some((v) => v.required)
}
