import { useState, useEffect } from 'react';
import {
  Box,
  FormControl,
  Select,
  MenuItem,
  Typography,
  Chip,
  Tooltip,
  CircularProgress,
  SelectChangeEvent,
} from '@mui/material';
import SyncAlt from '@mui/icons-material/SyncAlt';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/api';

interface DevUser {
  id: string;
  email: string;
  name: string;
  primary_role: string;
}

const DevUserSwitcher = () => {
  const { user, setToken } = useAuth();
  const [devMode, setDevMode] = useState<boolean | null>(null);
  const [users, setUsers] = useState<DevUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);

  // Check if dev mode is enabled
  useEffect(() => {
    const checkDevMode = async () => {
      try {
        const status = await apiClient.getDevStatus();
        setDevMode(status.dev_mode);
        if (status.dev_mode) {
          // Load users for impersonation
          const usersData = await apiClient.listUsersForImpersonation();
          setUsers(usersData.users || []);
        }
      } catch {
        // Dev endpoints not available (production mode)
        setDevMode(false);
      } finally {
        setLoading(false);
      }
    };

    checkDevMode();
  }, []);

  const handleUserSwitch = async (event: SelectChangeEvent<string>) => {
    const targetUserId = event.target.value;
    if (!targetUserId || targetUserId === user?.id) return;

    setSwitching(true);
    try {
      const result = await apiClient.impersonateUser(targetUserId);
      // Update the token in auth context and localStorage
      setToken(result.token);
      // Reload the page to refresh all data with new user context
      window.location.reload();
    } catch (error) {
      console.error('Failed to impersonate user:', error);
    } finally {
      setSwitching(false);
    }
  };

  // Don't render anything if not in dev mode or still checking
  if (devMode === null || loading) {
    return null;
  }

  if (!devMode) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
      <Tooltip title="Development Mode: Switch User">
        <Chip
          icon={<SyncAlt />}
          label="DEV"
          size="small"
          color="warning"
          sx={{ mr: 1 }}
        />
      </Tooltip>
      <FormControl size="small" sx={{ minWidth: 200 }}>
        <Select
          value={users.some(u => u.id === user?.id) ? user?.id : ''}
          onChange={handleUserSwitch}
          displayEmpty
          disabled={switching}
          sx={{
            bgcolor: 'background.paper',
            '& .MuiSelect-select': {
              py: 0.5,
              display: 'flex',
              alignItems: 'center',
            },
          }}
          renderValue={(selected) => {
            if (switching) {
              return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={16} />
                  <Typography variant="body2">Switching...</Typography>
                </Box>
              );
            }
            const selectedUser = users.find((u) => u.id === selected);
            if (!selectedUser) {
              return <Typography variant="body2">Select user</Typography>;
            }
            return (
              <Box>
                <Typography variant="body2" component="span">
                  {selectedUser.name || selectedUser.email}
                </Typography>
                <Typography
                  variant="caption"
                  component="span"
                  sx={{ ml: 1, color: 'text.secondary' }}
                >
                  ({selectedUser.primary_role})
                </Typography>
              </Box>
            );
          }}
        >
          {users.map((u) => (
            <MenuItem key={u.id} value={u.id}>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography variant="body2">
                  {u.name || u.email}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {u.email} - {u.primary_role}
                </Typography>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};

export default DevUserSwitcher;
