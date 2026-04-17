import React from 'react';
import {
  Box,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import ContentCopy from '@mui/icons-material/ContentCopy';
import type { ModuleInputVar } from '../types';
import {
  buildRequiredInputsExample,
  buildSourceExample,
  hasRequiredInputs,
} from '../utils/terraformExample';

export type UsageTool = 'terraform' | 'opentofu';

const STORAGE_KEY = 'preferredTool';

function readPreferredTool(): UsageTool {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'opentofu' || v === 'terraform') return v;
  } catch {
    // ignore
  }
  return 'terraform';
}

function writePreferredTool(tool: UsageTool): void {
  try {
    localStorage.setItem(STORAGE_KEY, tool);
  } catch {
    // ignore
  }
}

export interface UsageExampleProps {
  registryHost: string;
  namespace: string;
  name: string;
  system: string;
  version: string;
  inputs?: ModuleInputVar[] | null;
  /** Called after a successful clipboard write (used for aria-live announce / toast). */
  onCopied?: () => void;
  'data-testid'?: string;
}

const UsageExample: React.FC<UsageExampleProps> = ({
  registryHost,
  namespace,
  name,
  system,
  version,
  inputs,
  onCopied,
  'data-testid': testId = 'usage-example',
}) => {
  const [tool, setTool] = React.useState<UsageTool>(() => readPreferredTool());
  const [tab, setTab] = React.useState(0);
  const [copied, setCopied] = React.useState(false);

  const showInputsTab = hasRequiredInputs(inputs);
  const activeTab = showInputsTab ? tab : 0;

  const opts = { registryHost, namespace, name, system, version, inputs, tool };
  const sourceBlock = buildSourceExample(opts);
  const inputsBlock = buildRequiredInputsExample(opts);
  const visible = activeTab === 1 ? inputsBlock : sourceBlock;

  const handleToolChange = (_: unknown, next: UsageTool | null) => {
    if (!next) return;
    setTool(next);
    writePreferredTool(next);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(visible);
      setCopied(true);
      onCopied?.();
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may be unavailable (e.g. insecure context) — no-op
    }
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }} data-testid={testId}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={1}
        sx={{ mb: 2 }}
      >
        <Typography variant="h6">Usage Example</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <ToggleButtonGroup
            size="small"
            exclusive
            value={tool}
            onChange={handleToolChange}
            aria-label="Tool"
            data-testid={`${testId}-tool`}
          >
            <ToggleButton value="terraform" aria-label="Terraform">
              Terraform
            </ToggleButton>
            <ToggleButton value="opentofu" aria-label="OpenTofu">
              OpenTofu
            </ToggleButton>
          </ToggleButtonGroup>
          <Tooltip title={copied ? 'Copied!' : 'Copy example'}>
            <IconButton
              aria-label="Copy example"
              size="small"
              onClick={handleCopy}
              data-testid={`${testId}-copy`}
            >
              <ContentCopy />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {showInputsTab && (
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ mb: 1 }}
          data-testid={`${testId}-tabs`}
        >
          <Tab label="Source" />
          <Tab label="With required inputs" />
        </Tabs>
      )}

      <Box
        component="pre"
        data-testid={`${testId}-code`}
        sx={{
          p: 2,
          m: 0,
          backgroundColor: (theme) =>
            theme.palette.mode === 'dark' ? '#2d2d2d' : '#f5f5f5',
          color: (theme) => (theme.palette.mode === 'dark' ? '#e6e6e6' : '#1e1e1e'),
          borderRadius: 1,
          overflow: 'auto',
          fontSize: '0.875rem',
        }}
      >
        <code>{visible}</code>
      </Box>

      {showInputsTab && activeTab === 1 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Placeholders are the zero-value for each type — fill them before running
          <code style={{ marginLeft: 4 }}>{tool === 'opentofu' ? 'tofu apply' : 'terraform apply'}</code>.
        </Typography>
      )}
    </Paper>
  );
};

export default UsageExample;
