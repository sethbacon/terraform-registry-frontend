import { Outlet, Link as RouterLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
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
  Chip,
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
import SearchIcon from '@mui/icons-material/Search';
import AdminPanelSettings from '@mui/icons-material/AdminPanelSettings';
import VerifiedUser from '@mui/icons-material/VerifiedUser';
import Security from '@mui/icons-material/Security';
import Storage from '@mui/icons-material/Storage';
import HourglassEmpty from '@mui/icons-material/HourglassEmpty';
import Policy from '@mui/icons-material/Policy';
import ManageAccounts from '@mui/icons-material/ManageAccounts';
import SyncAlt from '@mui/icons-material/SyncAlt';
import Description from '@mui/icons-material/Description';
import ExpandMore from '@mui/icons-material/ExpandMore';
import History from '@mui/icons-material/History';
import ExpandLess from '@mui/icons-material/ExpandLess';
import Palette from '@mui/icons-material/Palette';
import SettingsIcon from '@mui/icons-material/Settings';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useThemeMode } from '../contexts/ThemeContext';
import { useHelp } from '../contexts/HelpContext';
import DevUserSwitcher from './DevUserSwitcher';
import HelpPanel, { HELP_PANEL_WIDTH } from './HelpPanel';
import AboutModal from './AboutModal';
import AdminBreadcrumbs from './AdminBreadcrumbs';
import CommandPalette from './CommandPalette';
import { useHotkey } from '../hooks/useHotkey';
import SessionExpiryWarning from './SessionExpiryWarning';

const drawerWidth = 240;

const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'ja'] as const;

const Layout = () => {
  const { t } = useTranslation();
  const { user, isAuthenticated, logout, allowedScopes } = useAuth();
  const { mode, toggleTheme, productName, logoUrl } = useThemeMode();
  const { helpOpen, openHelp } = useHelp();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const location = useLocation();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsAnchorEl, setSettingsAnchorEl] = useState<null | HTMLElement>(null);
  const [supportAnchorEl, setSupportAnchorEl] = useState<null | HTMLElement>(null);
  useHotkey('mod+k', useCallback(() => setPaletteOpen((v) => !v), []));

  // Helper to check if user has a specific scope (or admin which grants all)
  const hasScope = useCallback((scope: string) => {
    return allowedScopes.includes('admin') || allowedScopes.includes(scope);
  }, [allowedScopes]);

  const handleMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleLogout = useCallback(() => {
    handleClose();
    logout();
    // logout() redirects the browser to the backend logout endpoint, which forwards
    // to the OIDC provider's end_session_endpoint. Do not navigate() here — the
    // full-page redirect from logout() takes over immediately.
  }, [handleClose, logout]);

  const handleDrawerToggle = useCallback(() => {
    setMobileOpen(prev => !prev);
  }, []);

  const handleSettingsMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setSettingsAnchorEl(event.currentTarget);
  }, []);

  const handleSettingsMenuClose = useCallback(() => {
    setSettingsAnchorEl(null);
  }, []);

  const handleSupportMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setSupportAnchorEl(event.currentTarget);
  }, []);

  const handleSupportMenuClose = useCallback(() => {
    setSupportAnchorEl(null);
  }, []);

  const handleDarkModeToggle = useCallback(() => {
    toggleTheme();
    setSettingsAnchorEl(null);
  }, [toggleTheme]);

  const handleChangeLanguage = useCallback((lang: string) => {
    i18n.changeLanguage(lang);
    setSettingsAnchorEl(null);
  }, []);

  const handleOpenContextHelp = useCallback(() => {
    setSupportAnchorEl(null);
    openHelp();
  }, [openHelp]);

  const handleOpenAbout = useCallback(() => {
    setSupportAnchorEl(null);
    setAboutOpen(true);
  }, []);

  const navigationItems = useMemo(() => [
    { text: t('nav.home'), icon: <Home />, path: '/', tooltip: t('nav.homeTooltip') },
    { text: t('nav.modules'), icon: <ViewModule />, path: '/modules', tooltip: t('nav.modulesTooltip') },
    { text: t('nav.providers'), icon: <Extension />, path: '/providers', tooltip: t('nav.providersTooltip') },
    { text: t('nav.terraformBinaries'), icon: <GetApp />, path: '/terraform-binaries', tooltip: t('nav.terraformBinariesTooltip') },
    { text: t('nav.apiDocs'), icon: <Description />, path: '/api-docs', tooltip: t('nav.apiDocsTooltip') },
  ], [t]);

  // Admin nav groups — each group is collapsible. Items are filtered by scope.
  const adminNavGroups = useMemo(() => [
    {
      key: 'identity',
      label: t('nav.admin.identity'),
      items: [
        { text: t('nav.admin.organizations'), icon: <Business />, path: '/admin/organizations', tooltip: t('nav.admin.organizationsTooltip'), scope: 'organizations:read' },
        { text: t('nav.admin.roles'), icon: <AdminPanelSettings />, path: '/admin/roles', tooltip: t('nav.admin.rolesTooltip'), scope: 'users:read' },
        { text: t('nav.admin.users'), icon: <People />, path: '/admin/users', tooltip: t('nav.admin.usersTooltip'), scope: 'users:read' },
        { text: t('nav.admin.oidcGroups'), icon: <ManageAccounts />, path: '/admin/oidc', tooltip: t('nav.admin.oidcGroupsTooltip'), scope: 'admin' },
        { text: t('nav.admin.scim'), icon: <SyncAlt />, path: '/admin/scim', tooltip: t('nav.admin.scimTooltip'), scope: 'admin' },
        { text: t('nav.admin.mtlsCerts'), icon: <VerifiedUser />, path: '/admin/mtls', tooltip: t('nav.admin.mtlsCertsTooltip'), scope: 'admin' },
        { text: t('nav.admin.apiKeys'), icon: <Key />, path: '/admin/apikeys', tooltip: t('nav.admin.apiKeysTooltip'), scope: null },
      ],
    },
    {
      key: 'source-control',
      label: t('nav.admin.sourceControl'),
      items: [
        { text: t('nav.admin.sourceControl'), icon: <GitHub />, path: '/admin/scm-providers', tooltip: t('nav.admin.sourceControlTooltip'), scope: 'scm:read' },
      ],
    },
    {
      key: 'mirroring',
      label: t('nav.admin.mirroring'),
      items: [
        { text: t('nav.admin.providerConfig'), icon: <CloudDownload />, path: '/admin/mirrors', tooltip: t('nav.admin.providerConfigTooltip'), scope: 'mirrors:read' },
        { text: t('nav.admin.binariesConfig'), icon: <GetApp />, path: '/admin/terraform-mirror', tooltip: t('nav.admin.binariesConfigTooltip'), scope: 'mirrors:read' },
        { text: t('nav.admin.approvals'), icon: <HourglassEmpty />, path: '/admin/approvals', tooltip: t('nav.admin.approvalsTooltip'), scope: 'mirrors:read' },
        { text: t('nav.admin.mirrorPolicies'), icon: <Policy />, path: '/admin/policies', tooltip: t('nav.admin.mirrorPoliciesTooltip'), scope: 'admin' },
      ],
    },
    {
      key: 'system',
      label: t('nav.admin.system'),
      items: [
        { text: t('nav.admin.storage'), icon: <Storage />, path: '/admin/storage', tooltip: t('nav.admin.storageTooltip'), scope: 'admin' },
        { text: t('nav.admin.securityScanning'), icon: <Security />, path: '/admin/security-scanning', tooltip: t('nav.admin.securityScanningTooltip'), scope: 'admin' },
        { text: t('nav.admin.auditLogs'), icon: <History />, path: '/admin/audit-logs', tooltip: t('nav.admin.auditLogsTooltip'), scope: 'audit:read' },
      ],
    },
  ], [t]);

  // Determine which group contains the current route (for mobile auto-open).
  const activeGroupKey = useMemo(() => {
    const match = adminNavGroups.find(g =>
      g.items.some(it => location.pathname.startsWith(it.path)),
    );
    return match?.key ?? null;
  }, [adminNavGroups, location.pathname]);

  // Track which groups are open — persisted to localStorage so state survives navigation/refresh.
  // On mobile, default to an accordion pattern: only the active group (or none) is open.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    if (isMobile) {
      return Object.fromEntries(
        adminNavGroups.map(g => [g.key, activeGroupKey ? g.key === activeGroupKey : false]),
      );
    }
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

  // When the viewport crosses the mobile/desktop boundary, re-apply sensible defaults.
  useEffect(() => {
    if (isMobile) {
      setOpenGroups(
        Object.fromEntries(
          adminNavGroups.map(g => [g.key, activeGroupKey ? g.key === activeGroupKey : false]),
        ),
      );
    }
    // Desktop: do not reset; keep whatever the user had, honoring their localStorage prefs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  const toggleGroup = useCallback((key: string) =>
    setOpenGroups(prev => {
      if (isMobile) {
        // Accordion: opening a group closes all others; toggling the open one closes it.
        const wasOpen = !!prev[key];
        const next = Object.fromEntries(
          adminNavGroups.map(g => [g.key, !wasOpen && g.key === key]),
        );
        return next;
      }
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem('adminNavGroups', JSON.stringify(next)); } catch { /* quota */ }
      return next;
    }), [isMobile, adminNavGroups]);

  // Filter each group's items by the user's scopes, then drop empty groups
  const visibleAdminGroups = useMemo(() =>
    isAuthenticated
      ? adminNavGroups
        .map(group => ({
          ...group,
          items: group.items.filter(item => item.scope === null || hasScope(item.scope)),
        }))
        .filter(group => group.items.length > 0)
      : [],
    [isAuthenticated, adminNavGroups, hasScope]);

  const handleCloseMobileDrawer = useCallback(() => {
    setMobileOpen(false);
  }, []);

  const handleCloseAbout = useCallback(() => {
    setAboutOpen(false);
  }, []);

  const drawer = (
    <Box component="nav" aria-label="Main navigation">
      <Toolbar>
        {logoUrl ? (
          <Box
            component="img"
            src={logoUrl}
            alt={productName}
            sx={{ maxHeight: 32, maxWidth: 160, objectFit: 'contain', mr: 1 }}
          />
        ) : (
          <Typography variant="h6" noWrap component="div">
            {productName}
          </Typography>
        )}
      </Toolbar>
      <Divider />
      <List>
        {navigationItems.map((item) => {
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);
          return (
            <ListItem key={item.path} disablePadding>
              <Tooltip title={item.tooltip} placement="right" arrow>
                <ListItemButton
                  component={RouterLink}
                  to={item.path}
                  onClick={handleCloseMobileDrawer}
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
      {import.meta.env.DEV && (
        <>
          <Divider />
          <List>
            <ListItem disablePadding>
              <Tooltip title={t('nav.admin.componentsDevTooltip')} placement="right" arrow>
                <ListItemButton
                  component={RouterLink}
                  to="/dev/components"
                  onClick={handleCloseMobileDrawer}
                  sx={{
                    borderLeft: location.pathname === '/dev/components'
                      ? `3px solid ${theme.palette.warning.main}`
                      : '3px solid transparent',
                    bgcolor: location.pathname === '/dev/components'
                      ? `${theme.palette.warning.main}14`
                      : 'transparent',
                    pl: location.pathname === '/dev/components' ? '13px' : '16px',
                  }}
                >
                  <ListItemIcon sx={{ color: theme.palette.warning.main }}>
                    <Palette />
                  </ListItemIcon>
                  <ListItemText
                    primary={t('nav.admin.componentsDev')}
                    primaryTypographyProps={{
                      fontWeight: location.pathname === '/dev/components' ? 600 : 400,
                      fontSize: '0.875rem',
                    }}
                  />
                  <Chip label="DEV" size="small" color="warning" sx={{ height: 20, fontSize: '0.65rem' }} />
                </ListItemButton>
              </Tooltip>
            </ListItem>
          </List>
        </>
      )}
      {visibleAdminGroups.length > 0 && (
        <>
          <Divider />
          {/* Dashboard — always shown alone, no group header */}
          <List disablePadding>
            <ListItem disablePadding>
              {(() => {
                const isActive = location.pathname === '/admin';
                return (
                  <Tooltip title={t('nav.admin.dashboardTooltip')} placement="right" arrow>
                    <ListItemButton
                      component={RouterLink}
                      to="/admin"
                      onClick={handleCloseMobileDrawer}
                      sx={{
                        borderLeft: isActive ? `3px solid ${theme.palette.primary.main}` : '3px solid transparent',
                        bgcolor: isActive ? `${theme.palette.primary.main}14` : 'transparent',
                        pl: isActive ? '13px' : '16px',
                      }}
                    >
                      <ListItemIcon sx={{ color: isActive ? theme.palette.primary.main : 'inherit' }}>
                        <Dashboard />
                      </ListItemIcon>
                      <ListItemText primary={t('nav.admin.dashboard')} primaryTypographyProps={{ fontWeight: isActive ? 600 : 400 }} />
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
                        <ListItem key={item.path} disablePadding>
                          <Tooltip title={item.tooltip ?? item.text} placement="right" arrow>
                            <ListItemButton
                              component={RouterLink}
                              to={item.path}
                              onClick={handleCloseMobileDrawer}
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
      <a href="#main-content" className="skip-link">{t('header.skipToContent')}</a>
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
              aria-label={t('header.openDrawer')}
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {productName}
          </Typography>
          {isAuthenticated && <DevUserSwitcher />}
          <Tooltip title={t('header.quickNav')}>
            <IconButton
              color="inherit"
              onClick={() => setPaletteOpen(true)}
              aria-label={t('header.openCommandPalette')}
              data-testid="command-palette-trigger"
              sx={{ mr: 1 }}
            >
              <SearchIcon />
            </IconButton>
          </Tooltip>
          {/* Settings dropdown: dark mode + language */}
          <Tooltip title={t('header.settings')}>
            <IconButton
              color="inherit"
              onClick={handleSettingsMenuOpen}
              aria-label={t('header.settings')}
              aria-haspopup="true"
              aria-controls={settingsAnchorEl ? 'settings-menu' : undefined}
              sx={{ mr: 1 }}
            >
              <SettingsIcon />
            </IconButton>
          </Tooltip>
          <Menu
            id="settings-menu"
            anchorEl={settingsAnchorEl}
            open={Boolean(settingsAnchorEl)}
            onClose={handleSettingsMenuClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem onClick={handleDarkModeToggle}>
              {mode === 'dark'
                ? <Brightness7 sx={{ mr: 1.5 }} fontSize="small" />
                : <Brightness4 sx={{ mr: 1.5 }} fontSize="small" />}
              {mode === 'dark' ? t('header.lightMode') : t('header.darkMode')}
            </MenuItem>
            <Divider />
            {SUPPORTED_LANGUAGES.map((lang) => (
              <MenuItem
                key={lang}
                selected={i18n.language.startsWith(lang)}
                onClick={() => handleChangeLanguage(lang)}
              >
                {t(`language.${lang}`)}
              </MenuItem>
            ))}
          </Menu>
          {/* Support dropdown: context help + about */}
          <Tooltip title={t('header.support')}>
            <IconButton
              color="inherit"
              onClick={handleSupportMenuOpen}
              aria-label={t('header.support')}
              aria-haspopup="true"
              aria-controls={supportAnchorEl ? 'support-menu' : undefined}
              sx={{ mr: 1 }}
            >
              <HelpOutline />
            </IconButton>
          </Tooltip>
          <Menu
            id="support-menu"
            anchorEl={supportAnchorEl}
            open={Boolean(supportAnchorEl)}
            onClose={handleSupportMenuClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem onClick={handleOpenContextHelp}>
              <HelpOutline sx={{ mr: 1.5 }} fontSize="small" />
              {t('header.contextHelp')}
            </MenuItem>
            <MenuItem onClick={handleOpenAbout}>
              <InfoOutlined sx={{ mr: 1.5 }} fontSize="small" />
              {t('header.about')}
            </MenuItem>
          </Menu>
          {isAuthenticated ? (
            <div>
              <IconButton
                size="large"
                aria-label={t('header.accountMenu')}
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
                <MenuItem onClick={handleLogout}>{t('header.logout')}</MenuItem>
              </Menu>
            </div>
          ) : (
            <Button color="inherit" component={RouterLink} to="/login">
              {t('header.login')}
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
        id="main-content"
        tabIndex={-1}
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
        <AdminBreadcrumbs />
        <Outlet />
      </Box>

      {/* HelpPanel is position:fixed — keep it outside the flex row so
          its root element doesn't consume flex space when closed. */}
      <HelpPanel />
      <AboutModal open={aboutOpen} onClose={handleCloseAbout} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <SessionExpiryWarning />
    </Box>
  );
};

export default Layout;
