import { describe, expect, it } from 'vitest'
import { parseScanFindings } from '../scanParsers'

describe('parseScanFindings', () => {
  it('returns empty array for null raw_results', () => {
    expect(parseScanFindings('trivy', null)).toEqual([])
  })

  it('returns empty array for unknown scanner with no SARIF runs', () => {
    expect(parseScanFindings('unknown', { foo: 'bar' })).toEqual([])
  })

  describe('trivy', () => {
    it('parses vulnerabilities and misconfigurations', () => {
      const raw = {
        Results: [
          {
            Target: 'main.tf',
            Vulnerabilities: [
              {
                VulnerabilityID: 'CVE-2023-1234',
                PkgName: 'some-pkg',
                Title: 'Vuln title',
                Severity: 'CRITICAL',
                FixedVersion: '2.0.0',
              },
            ],
            Misconfigurations: [
              {
                ID: 'AVD-AWS-0001',
                Title: 'S3 bucket unencrypted',
                Severity: 'HIGH',
                Resolution: 'Enable encryption',
                CauseMetadata: { Resource: 'aws_s3_bucket.example' },
              },
            ],
          },
        ],
      }
      const rows = parseScanFindings('trivy', raw)
      expect(rows).toHaveLength(2)
      expect(rows[0].severity).toBe('CRITICAL')
      expect(rows[0].ruleId).toBe('CVE-2023-1234')
      expect(rows[0].resolution).toBe('Upgrade to 2.0.0')
      expect(rows[1].severity).toBe('HIGH')
      expect(rows[1].ruleId).toBe('AVD-AWS-0001')
      expect(rows[1].resource).toBe('aws_s3_bucket.example')
    })

    it('handles empty Results array', () => {
      expect(parseScanFindings('trivy', { Results: [] })).toEqual([])
    })
  })

  describe('checkov', () => {
    it('parses single object output', () => {
      const raw = {
        results: {
          failed_checks: [
            {
              check: { id: 'CKV_AWS_18', name: 'S3 logging', severity: 'medium' },
              resource: 'aws_s3_bucket.example',
              file_path: '/main.tf',
              guideline: 'https://docs.example.com',
            },
          ],
        },
      }
      const rows = parseScanFindings('checkov', raw)
      expect(rows).toHaveLength(1)
      expect(rows[0].severity).toBe('MEDIUM')
      expect(rows[0].ruleId).toBe('CKV_AWS_18')
      expect(rows[0].file).toBe('/main.tf')
    })

    it('parses array output (multiple frameworks)', () => {
      const raw = [
        {
          results: {
            failed_checks: [
              { check: { id: 'CKV_1', name: 'Check 1', severity: 'high' }, resource: 'r1' },
            ],
          },
        },
        {
          results: {
            failed_checks: [
              { check: { id: 'CKV_2', name: 'Check 2', severity: 'low' }, resource: 'r2' },
            ],
          },
        },
      ]
      const rows = parseScanFindings('checkov', raw as unknown as Record<string, unknown>)
      expect(rows).toHaveLength(2)
      expect(rows[0].severity).toBe('HIGH')
      expect(rows[1].severity).toBe('LOW')
    })
  })

  describe('terrascan', () => {
    it('parses violations', () => {
      const raw = {
        results: {
          violations: [
            {
              rule_id: 'AC_AWS_0001',
              rule_name: 's3BucketEncryption',
              severity: 'high',
              resource_name: 'aws_s3_bucket.example',
              file: 'main.tf',
            },
          ],
        },
      }
      const rows = parseScanFindings('terrascan', raw)
      expect(rows).toHaveLength(1)
      expect(rows[0].ruleId).toBe('AC_AWS_0001')
      expect(rows[0].severity).toBe('HIGH')
    })
  })

  describe('snyk', () => {
    it('parses single object output', () => {
      const raw = {
        vulnerabilities: [{ id: 'SNYK-001', title: 'Issue', severity: 'critical' }],
      }
      const rows = parseScanFindings('snyk', raw)
      expect(rows).toHaveLength(1)
      expect(rows[0].severity).toBe('CRITICAL')
      expect(rows[0].ruleId).toBe('SNYK-001')
    })

    it('parses array output (multiple files)', () => {
      const raw = [
        { vulnerabilities: [{ id: 'S1', title: 'A', severity: 'low' }] },
        { vulnerabilities: [{ id: 'S2', title: 'B', severity: 'high' }] },
      ]
      const rows = parseScanFindings('snyk', raw as unknown as Record<string, unknown>)
      expect(rows).toHaveLength(2)
      expect(rows[0].severity).toBe('HIGH')
      expect(rows[1].severity).toBe('LOW')
    })
  })

  describe('SARIF / custom', () => {
    it('parses SARIF runs', () => {
      const raw = {
        runs: [
          {
            results: [
              {
                ruleId: 'RULE-001',
                level: 'error',
                message: { text: 'Finding desc' },
                locations: [{ physicalLocation: { artifactLocation: { uri: 'main.tf' } } }],
              },
              {
                ruleId: 'RULE-002',
                level: 'warning',
                message: { text: 'Warning desc' },
              },
            ],
          },
        ],
      }
      const rows = parseScanFindings('custom', raw)
      expect(rows).toHaveLength(2)
      expect(rows[0].severity).toBe('HIGH')
      expect(rows[0].file).toBe('main.tf')
      expect(rows[1].severity).toBe('MEDIUM')
    })
  })

  it('sorts by severity (critical first)', () => {
    const raw = {
      Results: [
        {
          Target: 'test.tf',
          Misconfigurations: [
            { ID: 'L1', Title: 'Low', Severity: 'LOW' },
            { ID: 'C1', Title: 'Critical', Severity: 'CRITICAL' },
            { ID: 'M1', Title: 'Medium', Severity: 'MEDIUM' },
            { ID: 'H1', Title: 'High', Severity: 'HIGH' },
          ],
        },
      ],
    }
    const rows = parseScanFindings('trivy', raw)
    expect(rows.map((r) => r.severity)).toEqual(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'])
  })

  describe('format auto-detection (unknown scanner name)', () => {
    it('detects Trivy format by Results array', () => {
      const raw = {
        Results: [
          {
            Target: 'main.tf',
            Misconfigurations: [
              { ID: 'AVD-001', Title: 'Issue', Severity: 'HIGH', Resolution: 'Fix it' },
            ],
          },
        ],
      }
      const rows = parseScanFindings('pending', raw)
      expect(rows).toHaveLength(1)
      expect(rows[0].ruleId).toBe('AVD-001')
      expect(rows[0].severity).toBe('HIGH')
    })

    it('detects Checkov format by results.failed_checks', () => {
      const raw = {
        results: {
          failed_checks: [
            {
              check: { id: 'CKV_AWS_18', name: 'S3 logging', severity: 'medium' },
              resource: 'aws_s3_bucket.example',
            },
          ],
        },
      }
      const rows = parseScanFindings('unknown', raw)
      expect(rows).toHaveLength(1)
      expect(rows[0].ruleId).toBe('CKV_AWS_18')
    })

    it('detects Terrascan format by results.violations', () => {
      const raw = {
        results: {
          violations: [
            { rule_id: 'AC_001', rule_name: 'test', severity: 'high', resource_name: 'r1' },
          ],
        },
      }
      const rows = parseScanFindings('pending', raw)
      expect(rows).toHaveLength(1)
      expect(rows[0].ruleId).toBe('AC_001')
    })

    it('detects Snyk format by vulnerabilities array', () => {
      const raw = {
        vulnerabilities: [{ id: 'SNYK-001', title: 'Issue', severity: 'critical' }],
      }
      const rows = parseScanFindings('pending', raw)
      expect(rows).toHaveLength(1)
      expect(rows[0].ruleId).toBe('SNYK-001')
    })

    it('detects SARIF format by runs array', () => {
      const raw = {
        runs: [
          {
            results: [{ ruleId: 'R1', level: 'error', message: { text: 'Desc' } }],
          },
        ],
      }
      const rows = parseScanFindings('pending', raw)
      expect(rows).toHaveLength(1)
      expect(rows[0].severity).toBe('HIGH')
    })
  })
})
