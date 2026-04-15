import { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Divider,
  Paper,
  Chip,
  Link,
  Grid,
  Alert,
} from '@mui/material';
import RegistryItemCard from '../../components/RegistryItemCard';
import MarkdownRenderer from '../../components/MarkdownRenderer';
import ErrorBoundary from '../../components/ErrorBoundary';
import { ProviderIcon, providerDisplayName } from '../../components/ProviderIcon';
import SecurityScanPanel from '../../components/SecurityScanPanel';
import VersionDetailsPanel from '../../components/VersionDetailsPanel';
import AboutModal from '../../components/AboutModal';
import StorageMigrationWizard from '../../components/StorageMigrationWizard';
import type { ModuleVersion, ModuleScan, StorageConfigResponse } from '../../types';

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const sampleModuleVersion: ModuleVersion = {
  id: 'mv-001',
  module_id: 'mod-001',
  version: '2.3.1',
  download_count: 1247,
  published_at: '2026-03-15T10:00:00Z',
  published_by_name: 'jane.doe',
  deprecated: false,
};

const sampleDeprecatedVersion: ModuleVersion = {
  id: 'mv-002',
  module_id: 'mod-001',
  version: '1.0.0',
  download_count: 89,
  published_at: '2025-06-01T10:00:00Z',
  published_by_name: 'john.smith',
  deprecated: true,
  deprecated_at: '2026-01-15T10:00:00Z',
  deprecation_message: 'This version has a known security vulnerability. Please upgrade to v2.x.',
};

const sampleScanClean: ModuleScan = {
  id: 'scan-001',
  module_version_id: 'mv-001',
  scanner: 'tfsec',
  scanner_version: '1.28.4',
  expected_version: null,
  status: 'clean',
  scanned_at: '2026-03-15T11:00:00Z',
  critical_count: 0,
  high_count: 0,
  medium_count: 0,
  low_count: 0,
  raw_results: null,
  error_message: null,
  created_at: '2026-03-15T11:00:00Z',
  updated_at: '2026-03-15T11:00:00Z',
};

const sampleScanFindings: ModuleScan = {
  id: 'scan-002',
  module_version_id: 'mv-002',
  scanner: 'tfsec',
  scanner_version: '1.28.4',
  expected_version: null,
  status: 'findings',
  scanned_at: '2025-06-01T12:00:00Z',
  critical_count: 1,
  high_count: 3,
  medium_count: 5,
  low_count: 2,
  raw_results: null,
  error_message: null,
  created_at: '2025-06-01T12:00:00Z',
  updated_at: '2025-06-01T12:00:00Z',
};

const sampleStorageConfigs: StorageConfigResponse[] = [
  {
    id: 'sc-001',
    backend_type: 'local',
    is_active: true,
    azure_account_key_set: false,
    s3_access_key_id_set: false,
    s3_secret_access_key_set: false,
    gcs_credentials_json_set: false,
    created_at: '2025-06-01T12:00:00Z',
    updated_at: '2025-06-01T12:00:00Z',
  },
  {
    id: 'sc-002',
    backend_type: 's3',
    is_active: false,
    azure_account_key_set: false,
    s3_access_key_id_set: true,
    s3_secret_access_key_set: true,
    gcs_credentials_json_set: false,
    created_at: '2025-06-01T12:00:00Z',
    updated_at: '2025-06-01T12:00:00Z',
  },
];

const sampleMarkdown = `# Module README

## Overview

This is a **Terraform module** for deploying a VPC with public and private subnets.

## Usage

\`\`\`hcl
module "vpc" {
  source  = "registry.example.com/acme/vpc/aws"
  version = "~> 2.0"

  cidr_block         = "10.0.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b"]
}
\`\`\`

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| cidr_block | The CIDR block for the VPC | \`string\` | n/a | yes |
| availability_zones | List of AZs | \`list(string)\` | n/a | yes |
| enable_nat_gateway | Enable NAT gateway | \`bool\` | \`true\` | no |

## Outputs

| Name | Description |
|------|-------------|
| vpc_id | The ID of the VPC |
| public_subnet_ids | List of public subnet IDs |

## Notes

- Supports ~~legacy~~ and modern configurations
- See [Terraform docs](https://www.terraform.io/) for more info

### Task list (GFM)

- [x] VPC creation
- [x] Subnet creation
- [ ] Transit Gateway support
`;

const providerSlugs = [
  'aws',
  'azurerm',
  'google',
  'hashicorp',
  'vmware',
  'oci',
  'oracle',
  'vsphere',
  'googlecloud',
  'microsoft',
];

// ---------------------------------------------------------------------------
// Table of contents sections
// ---------------------------------------------------------------------------

interface TocEntry {
  id: string;
  label: string;
}

const TOC_ENTRIES: TocEntry[] = [
  { id: 'registry-item-card', label: 'RegistryItemCard' },
  { id: 'provider-icon', label: 'ProviderIcon' },
  { id: 'markdown-renderer', label: 'MarkdownRenderer' },
  { id: 'error-boundary', label: 'ErrorBoundary' },
  { id: 'security-scan-panel', label: 'SecurityScanPanel' },
  { id: 'version-details-panel', label: 'VersionDetailsPanel' },
  { id: 'about-modal', label: 'AboutModal' },
  { id: 'storage-migration-wizard', label: 'StorageMigrationWizard' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ComponentShowcase = () => {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [migrationWizardOpen, setMigrationWizardOpen] = useState(false);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h3" gutterBottom>
        Component Showcase
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Development-only style guide showing all key UI components with representative sample data.
        This page is only available when <code>import.meta.env.DEV</code> is true.
      </Typography>

      {/* Table of Contents */}
      <Paper variant="outlined" sx={{ p: 2, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Table of Contents
        </Typography>
        <Box component="nav" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {TOC_ENTRIES.map((entry) => (
            <Chip
              key={entry.id}
              label={entry.label}
              component="a"
              href={`#${entry.id}`}
              clickable
              size="small"
              variant="outlined"
            />
          ))}
        </Box>
      </Paper>

      {/* ----------------------------------------------------------------- */}
      {/* Cards */}
      {/* ----------------------------------------------------------------- */}
      <SectionHeader id="registry-item-card" title="RegistryItemCard" category="Cards" />

      <Typography variant="subtitle2" sx={{ mb: 2 }}>
        Module variant
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <RegistryItemCard
            title="acme/vpc/aws"
            subtitle="acme"
            description="A production-ready VPC module with public/private subnets, NAT gateways, and flow logs."
            chips={
              <>
                <Chip label="v2.3.1" size="small" sx={{ mr: 0.5 }} />
                <Chip label="1,247 downloads" size="small" variant="outlined" />
              </>
            }
            onClick={() => {}}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <RegistryItemCard
            title="acme/eks-cluster/aws"
            subtitle="acme"
            description="Deploys an EKS cluster with managed node groups, IRSA, and cluster autoscaler."
            badge={<Chip label="Network Mirrored" size="small" color="info" />}
            chips={<Chip label="v1.5.0" size="small" />}
            onClick={() => {}}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <RegistryItemCard
            title="acme/legacy-network/aws"
            subtitle="acme"
            description="Legacy networking module. Superseded by acme/vpc/aws."
            deprecated
            chips={<Chip label="v0.9.2" size="small" />}
            onClick={() => {}}
          />
        </Grid>
      </Grid>

      <Typography variant="subtitle2" sx={{ mb: 2 }}>
        Provider variant
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <RegistryItemCard
            title="hashicorp/aws"
            subtitle="hashicorp"
            description="The AWS provider is used to interact with the many resources supported by AWS."
            actionLabel="View Provider"
            actionColor="secondary"
            chips={
              <>
                <Chip label="v5.40.0" size="small" sx={{ mr: 0.5 }} />
                <Chip label="42,891 downloads" size="small" variant="outlined" />
              </>
            }
            onClick={() => {}}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <RegistryItemCard
            title="hashicorp/azurerm"
            subtitle="hashicorp"
            description="The AzureRM provider is used to interact with Azure Resource Manager resources."
            actionLabel="View Provider"
            actionColor="secondary"
            chips={<Chip label="v3.95.0" size="small" />}
            onClick={() => {}}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <RegistryItemCard
            title="minimal-card"
            description="A card with only the required props (title and onClick)."
            onClick={() => {}}
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 4 }} />

      {/* ----------------------------------------------------------------- */}
      {/* Provider Icons */}
      {/* ----------------------------------------------------------------- */}
      <SectionHeader id="provider-icon" title="ProviderIcon" category="Utilities" />

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {providerSlugs.map((slug) => (
            <Box key={slug} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
              <ProviderIcon provider={slug} size={36} />
              <Typography variant="caption">{providerDisplayName(slug)}</Typography>
              <Typography variant="caption" color="text.secondary">{slug}</Typography>
            </Box>
          ))}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="caption" color="text.secondary">(null)</Typography>
            </Box>
            <Typography variant="caption">Unknown</Typography>
            <Typography variant="caption" color="text.secondary">unknown-provider</Typography>
          </Box>
        </Box>
      </Paper>

      <Divider sx={{ my: 4 }} />

      {/* ----------------------------------------------------------------- */}
      {/* Markdown Renderer */}
      {/* ----------------------------------------------------------------- */}
      <SectionHeader id="markdown-renderer" title="MarkdownRenderer" category="Content" />

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <MarkdownRenderer>{sampleMarkdown}</MarkdownRenderer>
      </Paper>

      <Divider sx={{ my: 4 }} />

      {/* ----------------------------------------------------------------- */}
      {/* ErrorBoundary */}
      {/* ----------------------------------------------------------------- */}
      <SectionHeader id="error-boundary" title="ErrorBoundary" category="Utilities" />

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        The ErrorBoundary component renders a fallback UI when a child component throws.
        Below is a static recreation of the fallback UI (triggering a real error would
        be destructive to the showcase page).
      </Typography>
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <ErrorBoundary>
          <ErrorBoundaryFallbackPreview />
        </ErrorBoundary>
      </Paper>

      <Divider sx={{ my: 4 }} />

      {/* ----------------------------------------------------------------- */}
      {/* SecurityScanPanel */}
      {/* ----------------------------------------------------------------- */}
      <SectionHeader id="security-scan-panel" title="SecurityScanPanel" category="Detail Panels" />

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Clean scan
      </Typography>
      <SecurityScanPanel
        canManage
        selectedVersion={sampleModuleVersion}
        moduleScan={sampleScanClean}
        scanLoading={false}
        scanNotFound={false}
      />

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Scan with findings
      </Typography>
      <SecurityScanPanel
        canManage
        selectedVersion={sampleModuleVersion}
        moduleScan={sampleScanFindings}
        scanLoading={false}
        scanNotFound={false}
      />

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        No scan available
      </Typography>
      <SecurityScanPanel
        canManage
        selectedVersion={sampleModuleVersion}
        moduleScan={null}
        scanLoading={false}
        scanNotFound
      />

      <Divider sx={{ my: 4 }} />

      {/* ----------------------------------------------------------------- */}
      {/* VersionDetailsPanel */}
      {/* ----------------------------------------------------------------- */}
      <SectionHeader id="version-details-panel" title="VersionDetailsPanel" category="Detail Panels" />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Active version
          </Typography>
          <VersionDetailsPanel
            selectedVersion={sampleModuleVersion}
            canManage
            deprecating={false}
            onUndeprecate={async () => {}}
            onOpenDeprecateDialog={() => {}}
            onOpenDeleteVersionDialog={() => {}}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Deprecated version
          </Typography>
          <VersionDetailsPanel
            selectedVersion={sampleDeprecatedVersion}
            canManage
            deprecating={false}
            onUndeprecate={async () => {}}
            onOpenDeprecateDialog={() => {}}
            onOpenDeleteVersionDialog={() => {}}
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 4 }} />

      {/* ----------------------------------------------------------------- */}
      {/* AboutModal */}
      {/* ----------------------------------------------------------------- */}
      <SectionHeader id="about-modal" title="AboutModal" category="Dialogs" />

      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Click the button below to open the About dialog.
        </Typography>
        <Chip
          label="Open AboutModal"
          onClick={() => setAboutOpen(true)}
          clickable
          color="primary"
        />
        <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
      </Box>

      <Divider sx={{ my: 4 }} />

      {/* ----------------------------------------------------------------- */}
      {/* StorageMigrationWizard */}
      {/* ----------------------------------------------------------------- */}
      <SectionHeader id="storage-migration-wizard" title="StorageMigrationWizard" category="Dialogs" />

      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Click the button below to open the Storage Migration Wizard dialog. Note: API
          calls will fail in this showcase context, but the UI flow is visible.
        </Typography>
        <Chip
          label="Open StorageMigrationWizard"
          onClick={() => setMigrationWizardOpen(true)}
          clickable
          color="primary"
        />
        <StorageMigrationWizard
          open={migrationWizardOpen}
          onClose={() => setMigrationWizardOpen(false)}
          configs={sampleStorageConfigs}
        />
      </Box>

      {/* Footer note */}
      <Divider sx={{ my: 4 }} />
      <Alert severity="info" sx={{ mb: 2 }}>
        Components that require API calls or complex context (PublishFromSCMWizard,
        RepositoryBrowser, DevUserSwitcher, HelpPanel, Layout, ProtectedRoute) are not
        rendered in this showcase because they depend on live backend services or deep
        context providers. See the component source files for their prop interfaces.
      </Alert>
      <Typography variant="caption" color="text.secondary">
        Route: <code>/dev/components</code> &mdash; available only in development mode.
      </Typography>
    </Container>
  );
};

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

/** Reusable section header with anchor target. */
function SectionHeader({ id, title, category }: { id: string; title: string; category: string }) {
  return (
    <Box id={id} sx={{ scrollMarginTop: '80px', mb: 2 }}>
      <Typography variant="overline" color="text.secondary">
        {category}
      </Typography>
      <Typography variant="h5">
        <Link href={`#${id}`} underline="hover" color="inherit">
          {title}
        </Link>
      </Typography>
    </Box>
  );
}

/** Static recreation of the ErrorBoundary fallback so we do not crash the page. */
function ErrorBoundaryFallbackPreview() {
  return (
    <Alert severity="error">
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        Something went wrong
      </Typography>
      <Typography variant="body2" sx={{ mb: 1 }}>
        An unexpected error occurred. You can try again or reload the page.
      </Typography>
      <Box
        component="pre"
        sx={{
          fontSize: '0.75rem',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          bgcolor: 'action.hover',
          p: 1,
          borderRadius: 1,
          mb: 1,
        }}
      >
        TypeError: Cannot read properties of null (reading &apos;map&apos;)
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Chip label="Try Again" size="small" variant="outlined" />
        <Chip label="Reload Page" size="small" color="primary" />
      </Box>
    </Alert>
  );
}

export default ComponentShowcase;
