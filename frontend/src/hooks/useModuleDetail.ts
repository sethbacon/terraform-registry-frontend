import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Module, ModuleVersion, ModuleScan, ModuleDoc } from '../types';
import type { ModuleSCMLink, SCMWebhookEvent } from '../types/scm';
import { useAuth } from '../contexts/AuthContext';
import { REGISTRY_HOST } from '../config';
import { getErrorMessage, getErrorStatus } from '../utils/errors';

export function useModuleDetail() {
  const { namespace, name, system } = useParams<{
    namespace: string;
    name: string;
    system: string;
  }>();
  const navigate = useNavigate();
  const { isAuthenticated, allowedScopes } = useAuth();
  const canManage = isAuthenticated && (allowedScopes.includes('admin') || allowedScopes.includes('modules:write'));

  const [module, setModule] = useState<Module | null>(null);
  const [versions, setVersions] = useState<ModuleVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<ModuleVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedSource, setCopiedSource] = useState(false);
  const [deleteModuleDialogOpen, setDeleteModuleDialogOpen] = useState(false);
  const [deleteVersionDialogOpen, setDeleteVersionDialogOpen] = useState(false);
  const [versionToDelete, setVersionToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deprecateDialogOpen, setDeprecateDialogOpen] = useState(false);
  const [deprecationMessage, setDeprecationMessage] = useState('');
  const [deprecating, setDeprecating] = useState(false);

  // SCM linking state
  const [scmLink, setScmLink] = useState<ModuleSCMLink | null>(null);
  const [scmLinkLoaded, setScmLinkLoaded] = useState(false);
  const [scmWizardOpen, setScmWizardOpen] = useState(false);
  const [scmSyncing, setScmSyncing] = useState(false);
  const [scmUnlinking, setScmUnlinking] = useState(false);

  // Webhook events state
  const [webhookEvents, setWebhookEvents] = useState<SCMWebhookEvent[]>([]);
  const [webhookEventsLoaded, setWebhookEventsLoaded] = useState(false);
  const [webhookEventsLoading, setWebhookEventsLoading] = useState(false);
  const [webhookEventsExpanded, setWebhookEventsExpanded] = useState(false);

  // Security scan state
  const [moduleScan, setModuleScan] = useState<ModuleScan | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanNotFound, setScanNotFound] = useState(false);

  // Module docs state
  const [moduleDocs, setModuleDocs] = useState<ModuleDoc | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);

  const loadSCMLink = useCallback(async (moduleId: string) => {
    try {
      const link = await api.getModuleSCMInfo(moduleId);
      setScmLink(link);
    } catch {
      setScmLink(null); // 404 = not linked, which is fine
    } finally {
      setScmLinkLoaded(true);
    }
  }, []);

  const loadModuleScan = useCallback(async (version: string) => {
    if (!namespace || !name || !system) return;
    setScanLoading(true);
    setScanNotFound(false);
    setModuleScan(null);
    try {
      const scan = await api.getModuleScan(namespace, name, system, version);
      setModuleScan(scan);
    } catch (err: unknown) {
      if (getErrorStatus(err) === 404) {
        setScanNotFound(true);
      }
    } finally {
      setScanLoading(false);
    }
  }, [namespace, name, system]);

  const loadModuleDocs = useCallback(async (version: string) => {
    if (!namespace || !name || !system) return;
    setDocsLoading(true);
    setModuleDocs(null);
    try {
      const docs = await api.getModuleDocs(namespace, name, system, version);
      setModuleDocs(docs);
    } catch {
      setModuleDocs(null);
    } finally {
      setDocsLoading(false);
    }
  }, [namespace, name, system]);

  const loadModuleDetails = useCallback(async () => {
    if (!namespace || !name || !system) return;

    try {
      setLoading(true);
      setError(null);

      // Use getModule API which returns module with embedded versions
      // Also fetch versions from the Terraform protocol endpoint for readme/published_at
      const [moduleData, versionsData] = await Promise.all([
        api.getModule(namespace, name, system),
        api.getModuleVersions(namespace, name, system),
      ]);

      if (!moduleData) {
        setError('Module not found');
        return;
      }

      setModule(moduleData);
      if (moduleData?.id && isAuthenticated) {
        loadSCMLink(moduleData.id);
      }

      // Merge version data - getModule has basic version info, getModuleVersions has readme/published_at
      const protocolVersions = Array.isArray(versionsData?.modules?.[0]?.versions) ? versionsData.modules[0].versions : [];
      const moduleVersions = Array.isArray(moduleData?.versions) ? moduleData.versions : [];

      // Use protocol versions as they have more complete data (readme, published_at)
      // Fall back to module versions if protocol versions not available
      const rawVersions: ModuleVersion[] = protocolVersions.length > 0 ? protocolVersions : moduleVersions;

      // Sort by semver descending so latest is always first
      const mergedVersions = [...rawVersions].sort((a, b) => {
        const parseParts = (v: string): [number, number, number] => {
          const clean = v.replace(/^v/, '').split('-')[0];
          const [maj = 0, min = 0, pat = 0] = clean.split('.').map(Number);
          return [maj, min, pat];
        };
        const [aMaj, aMin, aPat] = parseParts(a.version);
        const [bMaj, bMin, bPat] = parseParts(b.version);
        return bMaj !== aMaj ? bMaj - aMaj : bMin !== aMin ? bMin - aMin : bPat - aPat;
      });
      setVersions(mergedVersions);

      // Select latest version by default (preserve current selection if reloading)
      if (mergedVersions.length > 0) {
        setSelectedVersion(prev => {
          const currentVersion = prev?.version;
          const matchingVersion = currentVersion
            ? mergedVersions.find((v: ModuleVersion) => v.version === currentVersion)
            : null;
          return matchingVersion || mergedVersions[0];
        });
      }
    } catch (err: unknown) {
      console.error('Failed to load module details:', err);
      if (getErrorStatus(err) === 404) {
        setError('Module not found');
      } else {
        setError(getErrorMessage(err, 'Failed to load module details'));
      }
    } finally {
      setLoading(false);
    }
  }, [namespace, name, system, isAuthenticated, loadSCMLink]);

  useEffect(() => {
    loadModuleDetails();
  }, [loadModuleDetails]);

  useEffect(() => {
    if (!selectedVersion?.version || !namespace || !name || !system) return;
    setModuleScan(null);
    setScanNotFound(false);
    setModuleDocs(null);
    if (canManage) loadModuleScan(selectedVersion.version);
    loadModuleDocs(selectedVersion.version);
  }, [selectedVersion?.version, canManage, loadModuleScan, loadModuleDocs, namespace, name, system]);

  const loadWebhookEvents = async (moduleId: string) => {
    try {
      setWebhookEventsLoading(true);
      const events = await api.getWebhookEvents(moduleId);
      setWebhookEvents(Array.isArray(events) ? events : []);
    } catch {
      setWebhookEvents([]);
    } finally {
      setWebhookEventsLoading(false);
      setWebhookEventsLoaded(true);
    }
  };

  const handleSCMUnlink = async () => {
    if (!module?.id) return;
    try {
      setScmUnlinking(true);
      await api.unlinkModuleFromSCM(module.id);
      setScmLink(null);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to unlink repository'));
    } finally {
      setScmUnlinking(false);
    }
  };

  // Poll for updated versions after an async sync by reloading at 2 s, 5 s, and 12 s.
  // The sync runs in the background (202) so a single immediate reload is not enough.
  const pollForVersions = () => {
    [2000, 5000, 12000].forEach(delay => {
      setTimeout(() => loadModuleDetails(), delay);
    });
  };

  const handleSCMSync = async () => {
    if (!module?.id) {
      console.error('Cannot sync: module.id is not available');
      return;
    }
    console.log('Triggering manual sync for module:', module.id);
    try {
      setScmSyncing(true);
      await api.triggerManualSync(module.id);
      setError(null);
      // Start polling so newly imported versions appear without manual refresh.
      pollForVersions();
    } catch (err: unknown) {
      console.error('Sync failed:', err);
      setError(getErrorMessage(err, 'Failed to trigger sync'));
    } finally {
      setScmSyncing(false);
    }
  };

  const handleCopySource = () => {
    if (!module || !selectedVersion) return;

    const source = `${namespace}/${name}/${system}`;
    navigator.clipboard.writeText(source);
    setCopiedSource(true);
    setTimeout(() => setCopiedSource(false), 2000);
  };

  const handlePublishNewVersion = () => {
    navigate('/admin/upload/module', {
      state: {
        moduleData: {
          namespace,
          name,
          provider: system,
        },
      },
    });
  };

  const handleDeleteModule = async () => {
    if (!namespace || !name || !system) return;

    try {
      setDeleting(true);
      await api.deleteModule(namespace, name, system);
      navigate('/modules');
    } catch (err: unknown) {
      console.error('Failed to delete module:', err);
      const message = getErrorMessage(err, 'Failed to delete module. Please try again.');
      setError(message);
    } finally {
      setDeleting(false);
      setDeleteModuleDialogOpen(false);
    }
  };

  const handleDeleteVersion = async () => {
    if (!namespace || !name || !system || !versionToDelete) return;

    try {
      setDeleting(true);
      await api.deleteModuleVersion(namespace, name, system, versionToDelete);
      // Reload the module details
      await loadModuleDetails();
      setVersionToDelete(null);
    } catch (err: unknown) {
      console.error('Failed to delete version:', err);
      const message = getErrorMessage(err, 'Failed to delete version. Please try again.');
      setError(message);
    } finally {
      setDeleting(false);
      setDeleteVersionDialogOpen(false);
    }
  };

  const openDeleteVersionDialog = (version: string) => {
    setVersionToDelete(version);
    setDeleteVersionDialogOpen(true);
  };

  const handleDeprecateVersion = async () => {
    if (!namespace || !name || !system || !selectedVersion) return;

    try {
      setDeprecating(true);
      await api.deprecateModuleVersion(namespace, name, system, selectedVersion.version, deprecationMessage || undefined);
      // Reload the module details
      await loadModuleDetails();
      setDeprecationMessage('');
    } catch (err: unknown) {
      console.error('Failed to deprecate version:', err);
      const message = getErrorMessage(err, 'Failed to deprecate version. Please try again.');
      setError(message);
    } finally {
      setDeprecating(false);
      setDeprecateDialogOpen(false);
    }
  };

  const handleUndeprecateVersion = async () => {
    if (!namespace || !name || !system || !selectedVersion) return;

    try {
      setDeprecating(true);
      await api.undeprecateModuleVersion(namespace, name, system, selectedVersion.version);
      // Reload the module details
      await loadModuleDetails();
    } catch (err: unknown) {
      console.error('Failed to remove deprecation:', err);
      const message = getErrorMessage(err, 'Failed to remove deprecation. Please try again.');
      setError(message);
    } finally {
      setDeprecating(false);
    }
  };

  const handleUpdateDescription = async (newDescription: string) => {
    if (!module?.id) return;
    try {
      await api.updateModule(module.id, { description: newDescription });
      setModule(prev => prev ? { ...prev, description: newDescription } : prev);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update description'));
    }
  };

  const getTerraformExample = () => {
    if (!module || !selectedVersion) return '';

    const v = selectedVersion.version;
    const majorMinor = v.split('.').slice(0, 2).join('.');

    return `module "${name}" {
  source  = "${REGISTRY_HOST}/${namespace}/${name}/${system}"
  version = ">=${majorMinor}"
}`;
  };

  return {
    // Route params
    namespace,
    name,
    system,
    // Auth
    isAuthenticated,
    canManage,
    // Core module state
    module,
    versions,
    selectedVersion,
    setSelectedVersion,
    loading,
    error,
    copiedSource,
    // Delete module dialog
    deleteModuleDialogOpen,
    setDeleteModuleDialogOpen,
    deleting,
    // Delete version dialog
    deleteVersionDialogOpen,
    setDeleteVersionDialogOpen,
    versionToDelete,
    // Deprecate dialog
    deprecateDialogOpen,
    setDeprecateDialogOpen,
    deprecationMessage,
    setDeprecationMessage,
    deprecating,
    // SCM linking
    scmLink,
    scmLinkLoaded,
    scmWizardOpen,
    setScmWizardOpen,
    scmSyncing,
    scmUnlinking,
    // Webhook events
    webhookEvents,
    webhookEventsLoaded,
    webhookEventsLoading,
    webhookEventsExpanded,
    setWebhookEventsExpanded,
    // Security scan
    moduleScan,
    scanLoading,
    scanNotFound,
    // Module docs
    moduleDocs,
    docsLoading,
    // Handlers
    loadSCMLink,
    loadWebhookEvents,
    pollForVersions,
    handleSCMSync,
    handleSCMUnlink,
    handleCopySource,
    handlePublishNewVersion,
    handleDeleteModule,
    handleDeleteVersion,
    openDeleteVersionDialog,
    handleDeprecateVersion,
    handleUndeprecateVersion,
    handleUpdateDescription,
    getTerraformExample,
  };
}
