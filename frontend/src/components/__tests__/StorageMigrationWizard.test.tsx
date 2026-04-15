import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StorageMigrationWizard from '../StorageMigrationWizard';
import type { StorageConfigResponse } from '../../types';

// Mock api module
vi.mock('../../services/api', () => ({
  default: {
    planStorageMigration: vi.fn(),
    startStorageMigration: vi.fn(),
    getStorageMigration: vi.fn(),
    cancelStorageMigration: vi.fn(),
    listStorageMigrations: vi.fn(),
  },
}));

import api from '../../services/api';

const mockConfigs: StorageConfigResponse[] = [
  {
    id: 'cfg-1',
    backend_type: 'local',
    is_active: true,
    local_base_path: './data/storage',
    local_serve_directly: true,
    azure_account_key_set: false,
    s3_access_key_id_set: false,
    s3_secret_access_key_set: false,
    gcs_credentials_json_set: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'cfg-2',
    backend_type: 's3',
    is_active: false,
    s3_bucket: 'my-bucket',
    s3_region: 'us-east-1',
    s3_auth_method: 'default',
    azure_account_key_set: false,
    s3_access_key_id_set: false,
    s3_secret_access_key_set: false,
    gcs_credentials_json_set: false,
    created_at: '2026-01-02T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('StorageMigrationWizard', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    onClose.mockClear();
  });

  it('renders the dialog with all stepper labels when open', () => {
    render(
      <StorageMigrationWizard open={true} onClose={onClose} configs={mockConfigs} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText('Storage Migration Wizard')).toBeInTheDocument();
    expect(screen.getByText('Select Source & Target')).toBeInTheDocument();
    // "Review Plan" appears both as a step label and a button, so use getAllByText
    expect(screen.getAllByText('Review Plan').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Execute & Monitor')).toBeInTheDocument();
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('does not render the dialog when closed', () => {
    render(
      <StorageMigrationWizard open={false} onClose={onClose} configs={mockConfigs} />,
      { wrapper: createWrapper() },
    );

    expect(screen.queryByText('Storage Migration Wizard')).not.toBeInTheDocument();
  });

  it('renders source and target dropdowns on step 0', () => {
    render(
      <StorageMigrationWizard open={true} onClose={onClose} configs={mockConfigs} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByLabelText('Source Configuration')).toBeInTheDocument();
    expect(screen.getByLabelText('Target Configuration')).toBeInTheDocument();
  });

  it('defaults source to the active configuration', () => {
    render(
      <StorageMigrationWizard open={true} onClose={onClose} configs={mockConfigs} />,
      { wrapper: createWrapper() },
    );

    // The active config (Local File System) should be pre-selected as source
    const sourceSelect = screen.getByLabelText('Source Configuration');
    expect(sourceSelect).toHaveTextContent('Local File System');
  });

  it('disables Review Plan button when target is not selected', () => {
    render(
      <StorageMigrationWizard open={true} onClose={onClose} configs={mockConfigs} />,
      { wrapper: createWrapper() },
    );

    // Source is pre-selected but target is empty, so button should be disabled
    const reviewBtn = screen.getByRole('button', { name: /Review Plan/i });
    expect(reviewBtn).toBeDisabled();
  });

  it('calls planStorageMigration when Review Plan is clicked after selecting target', async () => {
    const user = userEvent.setup();
    const mockPlan = {
      source_config_id: 'cfg-1',
      target_config_id: 'cfg-2',
      total_artifacts: 10,
      total_modules: 5,
      total_providers: 5,
      estimated_size_bytes: 1024000,
    };
    vi.mocked(api.planStorageMigration).mockResolvedValue(mockPlan);

    render(
      <StorageMigrationWizard open={true} onClose={onClose} configs={mockConfigs} />,
      { wrapper: createWrapper() },
    );

    // Source is already pre-selected (active config). Select target.
    const targetSelect = screen.getByLabelText('Target Configuration');
    await user.click(targetSelect);
    // Find the option within the listbox to avoid matching the Select input itself
    const listbox = await screen.findByRole('listbox');
    const targetOption = within(listbox).getByText('Amazon S3');
    await user.click(targetOption);

    // Click Review Plan
    const reviewBtn = screen.getByRole('button', { name: /Review Plan/i });
    expect(reviewBtn).not.toBeDisabled();
    await user.click(reviewBtn);

    expect(api.planStorageMigration).toHaveBeenCalledWith('cfg-1', 'cfg-2');
  });

  it('calls onClose when Cancel button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <StorageMigrationWizard open={true} onClose={onClose} configs={mockConfigs} />,
      { wrapper: createWrapper() },
    );

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    await user.click(cancelBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows migration plan details after planning', async () => {
    const user = userEvent.setup();
    const mockPlan = {
      source_config_id: 'cfg-1',
      target_config_id: 'cfg-2',
      total_artifacts: 42,
      total_modules: 20,
      total_providers: 22,
      estimated_size_bytes: 5242880,
    };
    vi.mocked(api.planStorageMigration).mockResolvedValue(mockPlan);

    render(
      <StorageMigrationWizard open={true} onClose={onClose} configs={mockConfigs} />,
      { wrapper: createWrapper() },
    );

    // Source is already pre-selected. Select target.
    const targetSelect = screen.getByLabelText('Target Configuration');
    await user.click(targetSelect);
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByText('Amazon S3'));

    // Click Review Plan
    await user.click(screen.getByRole('button', { name: /Review Plan/i }));

    // Wait for plan to appear
    expect(await screen.findByText('Migration Plan')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('22')).toBeInTheDocument();
    expect(screen.getByText('5 MB')).toBeInTheDocument();
  });

  it('shows progress bar during migration execution', async () => {
    const user = userEvent.setup();
    const mockPlan = {
      source_config_id: 'cfg-1',
      target_config_id: 'cfg-2',
      total_artifacts: 10,
      total_modules: 5,
      total_providers: 5,
      estimated_size_bytes: 1024,
    };
    const mockMigration = {
      id: 'mig-1',
      source_config_id: 'cfg-1',
      target_config_id: 'cfg-2',
      status: 'running' as const,
      total_artifacts: 10,
      migrated_artifacts: 3,
      failed_artifacts: 0,
      created_at: '2026-01-01T00:00:00Z',
      started_at: '2026-01-01T00:00:01Z',
    };

    vi.mocked(api.planStorageMigration).mockResolvedValue(mockPlan);
    vi.mocked(api.startStorageMigration).mockResolvedValue(mockMigration);
    vi.mocked(api.getStorageMigration).mockResolvedValue(mockMigration);

    render(
      <StorageMigrationWizard open={true} onClose={onClose} configs={mockConfigs} />,
      { wrapper: createWrapper() },
    );

    // Select target
    const targetSelect = screen.getByLabelText('Target Configuration');
    await user.click(targetSelect);
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByText('Amazon S3'));

    // Click Review Plan
    await user.click(screen.getByRole('button', { name: /Review Plan/i }));
    await screen.findByText('Migration Plan');

    // Click Start Migration
    const startBtn = await screen.findByRole('button', { name: /Start Migration/i });
    await user.click(startBtn);

    // Verify progress display
    expect(await screen.findByText('Migration in Progress')).toBeInTheDocument();
    expect(screen.getByText(/3 \/ 10 artifacts/)).toBeInTheDocument();
    // Two progressbars: CircularProgress (indeterminate) + LinearProgress (determinate)
    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars.length).toBe(2);
    // The LinearProgress bar should show 30% (3/10)
    const linearBar = progressBars.find((el) => el.getAttribute('aria-valuenow') === '30');
    expect(linearBar).toBeTruthy();
    expect(screen.getByRole('button', { name: /Cancel Migration/i })).toBeInTheDocument();
  });
});
