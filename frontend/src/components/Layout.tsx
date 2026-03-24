import { Outlet, Link as RouterLink, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  Collapse,
  useTheme,
  useMediaQuery,
  Tooltip,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AccountCircle from '@mui/icons-material/AccountCircle';
import Dashboard from '@mui/icons-material/Dashboard';
import ViewModule from '@mui/icons-material/ViewModule';
import Extension from '@mui/icons-material/Extension';
import People from '@mui/icons-material/People';
import Business from '@mui/icons-material/Business';
import Key from '@mui/icons-material/Key';
import Home from '@mui/icons-material/Home';
import GitHub from '@mui/icons-material/GitHub';
import CloudDownload from '@mui/icons-material/CloudDownload';
import GetApp from '@mui/icons-material/GetApp';
import Brightness4 from '@mui/icons-material/Brightness4';
import Brightness7 from '@mui/icons-material/Brightness7';
import HelpOutline from '@mui/icons-material/HelpOutline';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import Shield from '@mui/icons-material/Shield';
import Storage from '@mui/icons-material/Storage';
import HourglassEmpty from '@mui/icons-material/HourglassEmpty';
import Policy from '@mui/icons-material/Policy';
import ManageAccounts from '@mui/icons-material/ManageAccounts';
import Description from '@mui/icons-material/Description';
import ExpandMore from '@mui/icons-material/ExpandMore';
import History from '@mui/icons-material/History';
import ExpandLess from '@mui/icons-material/ExpandLess';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useThemeMode } from '../contexts/ThemeContext';
import { useHelp } from '../contexts/HelpContext';
import DevUserSwitcher from './DevUserSwitcher';
import HelpPanel, { HELP_PANEL_WIDTH } from './HelpPanel';
import AboutModal from './AboutModal';

const drawerWidth = 240;

const Layout = () => {
  const { user, isAuthenticated, logout, allowedScopes } = useAuth();
  const { mode, toggleTheme } = useThemeMode();
  const { helpOpen, openHelp } = useHelp();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const location = useLocation();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  // Helper to check if user has a specific scope (or admin which grants all)
  const hasScope = (scope: string) => {
    return allowedScopes.includes('admin') || allowedScopes.includes(scope);
  };

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleClose();
    logout();
    // logout() redirects the browser to the backend logout endpoint, which forwards
    // to the OIDC provider's end_session_endpoint. Do not navigate() here — the
    // full-page redirect from logout() takes over immediately.
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const navigationItems = [
    { text: 'Home', icon: <Home />, path: '/', tooltip: 'Home Page' },
    { text: 'Modules', icon: <ViewModule />, path: '/modules', tooltip: 'View Terraform Modules' },
    { text: 'Providers', icon: <Extension />, path: '/providers', tooltip: 'View Terraform Providers' },
    { text: 'Terraform Binaries', icon: <GetApp />, path: '/terraform-binaries', tooltip: 'View Terraform Binaries' },
    { text: 'API Docs', icon: <Description />, path: '/api-docs', tooltip: 'API Documentation' },
  ];

  // Admin nav groups — each group is collapsible. Items are filtered by scope.
  const adminNavGroups = [
    {
      key: 'identity',
      label: 'Identity',
      items: [
        { text: 'Organizations', icon: <Business />, path: '/admin/organizations', tooltip: 'Manage registry organizations and members', scope: 'organizations:read' },
        { text: 'Roles', icon: <Shield />, path: '/admin/roles', tooltip: 'Configure role templates and permissions', scope: 'users:read' },
        { text: 'Users', icon: <People />, path: '/admin/users', tooltip: 'View and manage registry users', scope: 'users:read' },
        { text: 'OIDC Groups', icon: <ManageAccounts />, path: '/admin/oidc', tooltip: 'Map identity provider groups to registry roles', scope: 'admin' },
        { text: 'API Keys', icon: <Key />, path: '/admin/apikeys', tooltip: 'Create and manage personal API keys', scope: null },
      ],
    },
    {
      key: 'source-control',
      label: 'Source Control',
      items: [
        { text: 'Source Control', icon: <GitHub />, path: '/admin/scm-providers', tooltip: 'Configure SCM providers for module and provider publishing', scope: 'scm:read' },
      ],
    },
    {
      key: 'mirroring',
      label: 'Mirroring',
      items: [
        { text: 'Provider Config', icon: <CloudDownload />, path: '/admin/mirrors', tooltip: 'Configure provider mirror sources and sync schedules', scope: 'mirrors:read' },
        { text: 'Binaries Config', icon: <GetApp />, path: '/admin/terraform-mirror', tooltip: 'Configure Terraform and OpenTofu binary mirror sources', scope: 'mirrors:read' },
        { text: 'Approvals', icon: <HourglassEmpty />, path: '/admin/approvals', tooltip: 'Review and approve pending mirror sync requests', scope: 'mirrors:read' },
        { text: 'Mirror Policies', icon: <Policy />, path: '/admin/policies', tooltip: 'Define policies that control what gets mirrored', scope: 'admin' },
      ],
    },
    {
      key: 'system',
      label: 'System',
      items: [
        { text: 'Storage', icon: <Storage />, path: '/admin/storage', tooltip: 'Configure backend storage for binaries and providers', scope: 'admin' },
        { text: 'Audit Logs', icon: <History />, path: '/admin/audit-logs', tooltip: 'View system audit logs', scope: 'audit:read' },
      ],
    },
  ];

  // Track which groups are open — persisted to localStorage so state survives navigation/refresh.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('adminNavGroups');
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, boolean>;
        // Merge stored state with defaults (new groups default to open).
        return Object.fromEntries(adminNavGroups.map(g => [g.key, parsed[g.key] ?? true]));
      }
    } catch {
      // ignore malformed storage
    }
    return Object.fromEntries(adminNavGroups.map(g => [g.key, true]));
  });

  const toggleGroup = (key: string) =>
    setOpenGroups(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem('adminNavGroups', JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });

  // Filter each group's items by the user's scopes, then drop empty groups
  const visibleAdminGroups = isAuthenticated
    ? adminNavGroups
      .map(group => ({
        ...group,
        items: group.items.filter(item => item.scope === null || hasScope(item.scope)),
      }))
      .filter(group => group.items.length > 0)
    : [];

  const drawer = (
    <Box>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          Terraform Registry
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {navigationItems.map((item) => {
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);
          return (
            <ListItem key={item.text} disablePadding>
              <Tooltip title={item.tooltip} placement="right" arrow>
                <ListItemButton
                  component={RouterLink}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  sx={{
                    borderLeft: isActive ? `3px solid ${theme.palette.primary.main}` : '3px solid transparent',
                    bgcolor: isActive ? `${theme.palette.primary.main}14` : 'transparent',
                    pl: isActive ? '13px' : '16px',
                  }}
                >
                  <ListItemIcon sx={{ color: isActive ? theme.palette.primary.main : 'inherit' }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{ fontWeight: isActive ? 600 : 400 }}
                  />
                </ListItemButton>
              </Tooltip>
            </ListItem>
          );
        })}
      </List>
      {visibleAdminGroups.length > 0 && (
        <>
          <Divider />
          {/* Dashboard — always shown alone, no group header */}
          <List disablePadding>
            <ListItem disablePadding>
              {(() => {
                const isActive = location.pathname === '/admin';
                return (
                  <Tooltip title="Admin Dashboard" placement="right" arrow>
                    <ListItemButton
                      component={RouterLink}
                      to="/admin"
                      onClick={() => setMobileOpen(false)}
                      sx={{
                        borderLeft: isActive ? `3px solid ${theme.palette.primary.main}` : '3px solid transparent',
                        bgcolor: isActive ? `${theme.palette.primary.main}14` : 'transparent',
                        pl: isActive ? '13px' : '16px',
                      }}
                    >
                      <ListItemIcon sx={{ color: isActive ? theme.palette.primary.main : 'inherit' }}>
                        <Dashboard />
                      </ListItemIcon>
                      <ListItemText primary="Dashboard" primaryTypographyProps={{ fontWeight: isActive ? 600 : 400 }} />
                    </ListItemButton>
                  </Tooltip>
                );
              })()}
            </ListItem>
          </List>
          {visibleAdminGroups.map((group) => (
            <Box key={group.key}>
              <List disablePadding>
                {/* Group header — clicking collapses/expands the group */}
                <ListItemButton
                  onClick={() => toggleGroup(group.key)}
                  dense
                  sx={{ py: 0.5 }}
                >
                  <ListItemText
                    primary={group.label}
                    primaryTypographyProps={{
                      variant: 'caption',
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'text.secondary',
                    }}
                  />
                  {openGroups[group.key]
                    ? <ExpandLess fontSize="small" sx={{ color: 'text.secondary' }} />
                    : <ExpandMore fontSize="small" sx={{ color: 'text.secondary' }} />}
                </ListItemButton>
                <Collapse in={openGroups[group.key]} timeout="auto" unmountOnExit>
                  <List disablePadding>
                    {group.items.map((item) => {
                      const isActive = location.pathname.startsWith(item.path);
                      return (
                        <ListItem key={item.text} disablePadding>
                          <Tooltip title={item.tooltip ?? item.text} placement="right" arrow>
                            <ListItemButton
                              component={RouterLink}
                              to={item.path}
                              onClick={() => setMobileOpen(false)}
                              sx={{
                                pl: isActive ? '21px' : '24px',
                                borderLeft: isActive ? `3px solid ${theme.palette.primary.main}` : '3px solid transparent',
                                bgcolor: isActive ? `${theme.palette.primary.main}14` : 'transparent',
                              }}
                            >
                              <ListItemIcon sx={{ minWidth: 36, color: isActive ? theme.palette.primary.main : 'inherit' }}>
                                {item.icon}
                              </ListItemIcon>
                              <ListItemText
                                primary={item.text}
                                primaryTypographyProps={{ fontWeight: isActive ? 600 : 400 }}
                              />
                            </ListItemButton>
                          </Tooltip>
                        </ListItem>
                      );
                    })}
                  </List>
                </Collapse>
              </List>
            </Box>
          ))}
        </>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Terraform Registry
          </Typography>
          {isAuthenticated && <DevUserSwitcher />}
          <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
            <IconButton
              color="inherit"
              onClick={toggleTheme}
              aria-label="toggle dark mode"
              sx={{ mr: 1 }}
            >
              {mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Context Help">
            <IconButton
              color="inherit"
              onClick={openHelp}
              aria-label="Context help"
              sx={{ mr: 1 }}
            >
              <HelpOutline />
            </IconButton>
          </Tooltip>
          <Tooltip title="About">
            <IconButton
              color="inherit"
              onClick={() => setAboutOpen(true)}
              aria-label="About"
              sx={{ mr: 1 }}
            >
              <InfoOutlined />
            </IconButton>
          </Tooltip>
          {isAuthenticated ? (
            <div>
              <IconButton
                size="large"
                aria-label="account of current user"
                aria-controls="menu-appbar"
                aria-haspopup="true"
                onClick={handleMenu}
                color="inherit"
              >
                <AccountCircle />
              </IconButton>
              <Menu
                id="menu-appbar"
                anchorEl={anchorEl}
                anchorOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                keepMounted
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                open={Boolean(anchorEl)}
                onClose={handleClose}
              >
                <MenuItem disabled>
                  <Typography variant="body2">{user?.email}</Typography>
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleLogout}>Logout</MenuItem>
              </Menu>
            </div>
          ) : (
            <Button color="inherit" component={RouterLink} to="/login">
              Login
            </Button>
          )}
        </Toolbar>
      </AppBar>

      {/* Desktop drawer */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
            },
          }}
        >
          {drawer}
        </Drawer>
      )}

      {/* Mobile drawer */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          // minWidth:0 lets the flex child shrink correctly on narrow viewports.
          minWidth: 0,
          // Each page manages its own Container/padding; Layout only provides
          // the top offset so content clears the fixed AppBar.
          transition: theme.transitions.create('margin', {
            easing: helpOpen ? theme.transitions.easing.easeOut : theme.transitions.easing.sharp,
            duration: helpOpen
              ? theme.transitions.duration.enteringScreen
              : theme.transitions.duration.leavingScreen,
          }),
          mr: !isMobile && helpOpen ? `${HELP_PANEL_WIDTH}px` : 0,
          pl: 3,
          // Align Container children to the left edge of the content area.
          // A nested descendant selector has higher specificity than the base
          // MuiContainer rule, so this reliably overrides auto-centering that
          // would otherwise create a large left gap on wide screens (e.g. on a
          // 1920px monitor: (1680px area − 1200px max-width) / 2 = 240px gap).
          '& .MuiContainer-root': {
            marginLeft: 0,
          },
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>

      {/* HelpPanel is position:fixed — keep it outside the flex row so
          its root element doesn't consume flex space when closed. */}
      <HelpPanel />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </Box>
  );
};

export default Layout;
