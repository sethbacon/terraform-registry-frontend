import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Chip,
  CircularProgress,
  TextField,
  InputAdornment,
  Alert,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import CodeIcon from '@mui/icons-material/Code';
import TagIcon from '@mui/icons-material/Tag';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LockIcon from '@mui/icons-material/Lock';
import PublicIcon from '@mui/icons-material/Public';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { SCMRepository, SCMTag, SCMBranch } from '../types/scm';
import apiClient from '../services/api';

interface RepositoryBrowserProps {
  providerId: string;
  onRepositorySelect?: (repository: SCMRepository) => void;
  onTagSelect?: (repository: SCMRepository, tag: SCMTag) => void;
  selectedRepository?: SCMRepository | null;
  selectedTag?: SCMTag | null;
  nameFilter?: RegExp;
}

const RepositoryBrowser: React.FC<RepositoryBrowserProps> = ({
  providerId,
  onRepositorySelect,
  onTagSelect,
  selectedRepository,
  selectedTag,
  nameFilter,
}) => {
  const [repositories, setRepositories] = useState<SCMRepository[]>([]);
  const [tags, setTags] = useState<SCMTag[]>([]);
  const [branches, setBranches] = useState<SCMBranch[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTags, setLoadingTags] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRepo, setExpandedRepo] = useState<string | null>(null);

  useEffect(() => {
    if (providerId) {
      loadRepositories();
    }
  }, [providerId]);

  useEffect(() => {
    if (selectedRepository && expandedRepo === selectedRepository.full_name) {
      loadTagsAndBranches(selectedRepository);
    }
  }, [selectedRepository, expandedRepo]);

  const loadRepositories = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.listSCMRepositories(providerId);
      const repos = response.repositories || [];
      setRepositories(repos);
    } catch (err: any) {
      const status: number | undefined = err.response?.status;
      const serverMessage: string | undefined = err.response?.data?.error;
      console.error('[RepositoryBrowser] loadRepositories failed', {
        status,
        serverMessage,
        responseData: err.response?.data,
        message: err.message,
        url: err.config?.url,
      });
      if (status === 401 || status === 403) {
        setError(serverMessage || 'OAuth token is invalid or has been revoked; please reconnect to this SCM provider in Admin → SCM Providers.');
      } else {
        setError(serverMessage ? `Error ${status}: ${serverMessage}` : `Failed to load repositories (HTTP ${status ?? 'unknown'})`);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadTagsAndBranches = async (_repository: SCMRepository) => {
    try {
      setLoadingTags(true);
      setError(null);

      // Fetch real tags and branches from the API
      const [tagsResponse, branchesResponse] = await Promise.all([
        apiClient.listSCMRepositoryTags(providerId, _repository.owner, _repository.name),
        apiClient.listSCMRepositoryBranches(providerId, _repository.owner, _repository.name),
      ]);

      setTags(tagsResponse.tags || []);
      setBranches(branchesResponse.branches || []);
    } catch (err: any) {
      const status: number | undefined = err.response?.status;
      const serverMessage: string | undefined = err.response?.data?.error;
      console.error('[RepositoryBrowser] loadTagsAndBranches failed', {
        status,
        serverMessage,
        responseData: err.response?.data,
        message: err.message,
        url: err.config?.url,
      });
      setError(serverMessage ? `Error ${status}: ${serverMessage}` : `Failed to load tags and branches (HTTP ${status ?? 'unknown'})`);
      setTags([]);
      setBranches([]);
    } finally {
      setLoadingTags(false);
    }
  };

  const handleRepositoryClick = (repository: SCMRepository) => {
    if (expandedRepo === repository.full_name) {
      setExpandedRepo(null);
    } else {
      setExpandedRepo(repository.full_name);
      if (onRepositorySelect) {
        onRepositorySelect(repository);
      }
    }
  };

  const handleTagClick = (repository: SCMRepository, tag: SCMTag) => {
    if (onTagSelect) {
      onTagSelect(repository, tag);
    }
  };

  const nameMatchedRepositories = nameFilter
    ? repositories.filter((repo) => nameFilter.test(repo.name))
    : repositories;
  const hiddenCount = repositories.length - nameMatchedRepositories.length;

  const filteredRepositories = nameMatchedRepositories.filter(
    (repo) =>
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box mb={2} display="flex" gap={1}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search repositories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <Tooltip title="Refresh">
          <IconButton onClick={loadRepositories} size="small">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {nameFilter && hiddenCount > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {hiddenCount} {hiddenCount === 1 ? 'repository' : 'repositories'} hidden — must match Terraform naming convention: <strong>terraform-&lt;provider&gt;-&lt;name&gt;</strong> with only lowercase letters, digits, and hyphens.
        </Alert>
      )}

      {filteredRepositories.length === 0 ? (
        <Typography variant="body2" color="textSecondary" align="center" sx={{ py: 4 }}>
          No repositories found
        </Typography>
      ) : (
        <Box>
          {filteredRepositories.map((repo) => (
            <Accordion
              key={repo.full_name || repo.id}
              expanded={expandedRepo === repo.full_name}
              onChange={() => handleRepositoryClick(repo)}
              sx={{
                mb: 1,
                ...(selectedRepository?.full_name === repo.full_name && {
                  borderColor: 'primary.main',
                  borderWidth: 2,
                  borderStyle: 'solid',
                }),
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box display="flex" alignItems="center" width="100%">
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {selectedRepository?.full_name === repo.full_name ? (
                      <CheckCircleIcon color="primary" />
                    ) : (
                      <FolderIcon />
                    )}
                  </ListItemIcon>
                  <Box flexGrow={1}>
                    <Typography variant="subtitle1">{repo.full_name}</Typography>
                    {repo.description && (
                      <Typography variant="caption" color="textSecondary">
                        {repo.description}
                      </Typography>
                    )}
                  </Box>
                  {selectedRepository?.full_name === repo.full_name && (
                    <Chip label="Selected" color="primary" size="small" sx={{ mr: 1 }} />
                  )}
                  <Chip
                    icon={repo.private ? <LockIcon /> : <PublicIcon />}
                    label={repo.private ? 'Private' : 'Public'}
                    size="small"
                    sx={{ mr: 2 }}
                  />
                </Box>
              </AccordionSummary>

              <AccordionDetails>
                {loadingTags ? (
                  <Box display="flex" justifyContent="center" py={2}>
                    <CircularProgress size={24} />
                  </Box>
                ) : (
                  <>
                    {/* Tags Section */}
                    <Typography variant="subtitle2" gutterBottom>
                      Tags
                    </Typography>
                    {tags.length === 0 ? (
                      <Typography variant="body2" color="textSecondary" sx={{ py: 1 }}>
                        No tags found
                      </Typography>
                    ) : (
                      <List dense>
                        {tags.map((tag) => (
                          <ListItem
                            key={tag.tag_name}
                            disablePadding
                            secondaryAction={
                              tag.target_commit && (
                                <Chip
                                  label={tag.target_commit.substring(0, 7)}
                                  size="small"
                                  variant="outlined"
                                />
                              )
                            }
                          >
                            <ListItemButton
                              onClick={() => handleTagClick(repo, tag)}
                              selected={
                                selectedTag?.tag_name === tag.tag_name &&
                                selectedRepository?.full_name === repo.full_name
                              }
                              sx={{ borderRadius: 1 }}
                            >
                              <ListItemIcon sx={{ minWidth: 36 }}>
                                <TagIcon fontSize="small" />
                              </ListItemIcon>
                              <ListItemText
                                primary={tag.tag_name}
                                secondary={
                                  tag.tagged_at
                                    ? new Date(tag.tagged_at).toLocaleDateString()
                                    : undefined
                                }
                              />
                            </ListItemButton>
                          </ListItem>
                        ))}
                      </List>
                    )}

                    <Divider sx={{ my: 2 }} />

                    {/* Branches Section */}
                    <Typography variant="subtitle2" gutterBottom>
                      Branches
                    </Typography>
                    <List dense>
                      {branches.map((branch) => (
                        <ListItem
                          key={branch.branch_name}
                          secondaryAction={
                            branch.is_protected && (
                              <Chip label="Protected" size="small" color="primary" />
                            )
                          }
                        >
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            <CodeIcon fontSize="small" />
                          </ListItemIcon>
                          <ListItemText
                            primary={branch.branch_name}
                            secondary={branch.head_commit ? branch.head_commit.substring(0, 7) : 'N/A'}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </>
                )}
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default RepositoryBrowser;
