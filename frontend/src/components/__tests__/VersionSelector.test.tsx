import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VersionSelector, { VersionSelectorItem } from '../VersionSelector';

const versions: VersionSelectorItem[] = [
  { id: '1', version: '2.0.0' },
  { id: '2', version: '1.2.0' },
  { id: '3', version: '1.1.0', deprecated: true },
  { id: '4', version: '1.0.0', deprecated: true },
];

describe('VersionSelector', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('hides deprecated versions by default', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <VersionSelector
        versions={versions}
        selectedVersion={versions[0]}
        onSelectVersion={onSelect}
      />,
    );
    // Open the select
    await user.click(screen.getByRole('combobox'));
    // Only non-deprecated items should appear
    expect(screen.getByRole('option', { name: /2\.0\.0/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /1\.2\.0/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /1\.1\.0/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /1\.0\.0/ })).not.toBeInTheDocument();
  });

  it('toggle reveals deprecated versions and persists to localStorage', async () => {
    const user = userEvent.setup();
    render(
      <VersionSelector
        versions={versions}
        selectedVersion={versions[0]}
        onSelectVersion={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('switch', { name: /show deprecated/i }));
    expect(window.localStorage.getItem('showDeprecatedVersions')).toBe('true');
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('option', { name: /1\.1\.0.*DEPRECATED/ })).toBeInTheDocument();
  });

  it('honors persisted preference on mount', async () => {
    window.localStorage.setItem('showDeprecatedVersions', 'true');
    const user = userEvent.setup();
    render(
      <VersionSelector
        versions={versions}
        selectedVersion={versions[0]}
        onSelectVersion={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('option', { name: /1\.0\.0.*DEPRECATED/ })).toBeInTheDocument();
  });

  it('marks the first non-deprecated version as latest', async () => {
    const user = userEvent.setup();
    render(
      <VersionSelector
        versions={versions}
        selectedVersion={versions[0]}
        onSelectVersion={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('option', { name: /2\.0\.0.*latest/ })).toBeInTheDocument();
  });

  it('shows all-deprecated banner and reveals deprecated versions unconditionally', async () => {
    const allDep: VersionSelectorItem[] = [
      { id: 'a', version: '0.2.0', deprecated: true },
      { id: 'b', version: '0.1.0', deprecated: true },
    ];
    const user = userEvent.setup();
    render(
      <VersionSelector
        versions={allDep}
        selectedVersion={allDep[0]}
        onSelectVersion={vi.fn()}
      />,
    );
    expect(screen.getByTestId('version-selector-all-deprecated')).toBeInTheDocument();
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('option', { name: /0\.2\.0.*DEPRECATED/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /0\.1\.0.*DEPRECATED/ })).toBeInTheDocument();
  });

  it('falls back to first visible version when current selection is filtered out', async () => {
    const onSelect = vi.fn();
    render(
      <VersionSelector
        versions={versions}
        selectedVersion={versions[2]} // 1.1.0 deprecated
        onSelectVersion={onSelect}
      />,
    );
    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(versions[0]);
    });
  });

  it('invokes onSelectVersion when user picks a new version', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <VersionSelector
        versions={versions}
        selectedVersion={versions[0]}
        onSelectVersion={onSelect}
      />,
    );
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: /1\.2\.0/ }));
    expect(onSelect).toHaveBeenCalledWith(versions[1]);
  });
});
