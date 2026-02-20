import { Outlet, Link as RouterLink, useNavigate } from 'react-router-dom';
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
import Brightness4 from '@mui/icons-material/Brightness4';
import Brightness7 from '@mui/icons-material/Brightness7';
import HelpOutline from '@mui/icons-material/HelpOutline';
import Shield from '@mui/icons-material/Shield';
import Storage from '@mui/icons-material/Storage';
import Description from '@mui/icons-material/Description';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useThemeMode } from '../contexts/ThemeContext';
import { useHelp } from '../contexts/HelpContext';
import DevUserSwitcher from './DevUserSwitcher';
import HelpPanel, { HELP_PANEL_WIDTH } from './HelpPanel';

const drawerWidth = 240;

const Layout = () => {
  const { user, isAuthenticated, logout, allowedScopes } = useAuth();
  const { mode, toggleTheme } = useThemeMode();
  const { helpOpen, openHelp } = useHelp();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

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
    logout();
    handleClose();
    navigate('/login');
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const navigationItems = [
    { text: 'Home', icon: <Home />, path: '/' },
    { text: 'Modules', icon: <ViewModule />, path: '/modules' },
    { text: 'Providers', icon: <Extension />, path: '/providers' },
    { text: 'API Docs', icon: <Description />, path: '/api-docs' },
  ];

  // Admin items with required scopes - items only shown if user has the scope
  const allAdminItems = [
    { text: 'Dashboard', icon: <Dashboard />, path: '/admin', scope: null }, // Always visible when authenticated
    { text: 'Organizations', icon: <Business />, path: '/admin/organizations', scope: 'organizations:read' },
    { text: 'Roles', icon: <Shield />, path: '/admin/roles', scope: 'users:read' },
    { text: 'Users', icon: <People />, path: '/admin/users', scope: 'users:read' },
    { text: 'API Keys', icon: <Key />, path: '/admin/apikeys', scope: null }, // Self-service, always visible
    { text: 'SCM Providers', icon: <GitHub />, path: '/admin/scm-providers', scope: 'scm:read' },
    { text: 'Provider Mirrors', icon: <CloudDownload />, path: '/admin/mirrors', scope: 'mirrors:read' },
    { text: 'Storage', icon: <Storage />, path: '/admin/storage', scope: 'admin' }, // Admin only
  ];

  // Filter admin items based on user's scopes
  const adminItems = isAuthenticated
    ? allAdminItems.filter(item => item.scope === null || hasScope(item.scope))
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
        {navigationItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton component={RouterLink} to={item.path} onClick={() => setMobileOpen(false)}>
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      {adminItems.length > 0 && (
        <>
          <Divider />
          <List>
            {adminItems.map((item) => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton component={RouterLink} to={item.path} onClick={() => setMobileOpen(false)}>
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
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
    </Box>
  );
};

export default Layout;
