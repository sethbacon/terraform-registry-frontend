import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  TextField,
  Collapse,
  InputAdornment,
} from '@mui/material';
import Search from '@mui/icons-material/Search';
import ChevronRight from '@mui/icons-material/ChevronRight';
import { ProviderDocEntry } from '../types';

const FLAT_CATEGORY_ORDER = ['guides', 'functions', 'actions'];
const FLAT_CATEGORY_LABELS: Record<string, string> = {
  guides: 'Guides',
  functions: 'Functions',
  actions: 'Actions',
};

const SUBCAT_CATEGORIES = ['resources', 'data-sources', 'ephemeral-resources', 'list-resources'];
const SUBCAT_CATEGORY_LABELS: Record<string, string> = {
  resources: 'Resources',
  'data-sources': 'Data Sources',
  'ephemeral-resources': 'Ephemeral Resources',
  'list-resources': 'List Resources',
};

interface ProviderDocsSidebarProps {
  providerName: string;
  docs: ProviderDocEntry[];
  selectedCategory?: string;
  selectedSlug?: string;
  onSelect: (category: string, slug: string) => void;
  loading: boolean;
}

const sidebarFont = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

// Chevron that rotates 90° when expanded
const Chevron: React.FC<{ expanded: boolean }> = ({ expanded }) => (
  <ChevronRight
    fontSize="small"
    sx={{
      flexShrink: 0,
      color: 'text.disabled',
      transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
      transition: 'transform 150ms ease',
      fontSize: '1rem',
    }}
  />
);

const ProviderDocsSidebar: React.FC<ProviderDocsSidebarProps> = ({
  providerName,
  docs,
  selectedCategory,
  selectedSlug,
  onSelect,
  loading,
}) => {
  const [filter, setFilter] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedSubGroups, setExpandedSubGroups] = useState<Set<string>>(new Set());

  const filteredDocs = useMemo(() => {
    if (!filter.trim()) return docs;
    const q = filter.toLowerCase();
    return docs.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.slug.toLowerCase().includes(q) ||
        (d.subcategory && d.subcategory.toLowerCase().includes(q))
    );
  }, [docs, filter]);

  const organized = useMemo(() => {
    const byCategory = new Map<string, ProviderDocEntry[]>();
    for (const doc of filteredDocs) {
      if (!byCategory.has(doc.category)) byCategory.set(doc.category, []);
      byCategory.get(doc.category)!.push(doc);
    }

    const flatSections = FLAT_CATEGORY_ORDER
      .filter((cat) => byCategory.has(cat))
      .map((cat) => ({ cat, docs: byCategory.get(cat)! }));

    const subcatMap = new Map<string, Map<string, ProviderDocEntry[]>>();
    for (const cat of SUBCAT_CATEGORIES) {
      for (const doc of byCategory.get(cat) ?? []) {
        const sub = doc.subcategory ?? '';
        if (!subcatMap.has(sub)) subcatMap.set(sub, new Map());
        const catMap = subcatMap.get(sub)!;
        if (!catMap.has(cat)) catMap.set(cat, []);
        catMap.get(cat)!.push(doc);
      }
    }

    const subcategories = new Map<string, Map<string, ProviderDocEntry[]>>(
      [...subcatMap.entries()].sort(([a], [b]) => {
        if (a === '' && b === '') return 0;
        if (a === '') return 1;
        if (b === '') return -1;
        return a.localeCompare(b);
      })
    );

    return { overview: byCategory.get('overview') ?? [], flatSections, subcategories };
  }, [filteredDocs]);

  // Auto-expand the group containing the selected doc
  useEffect(() => {
    if (!selectedCategory || !selectedSlug) return;
    if (FLAT_CATEGORY_ORDER.includes(selectedCategory)) {
      setExpandedGroups((prev) => new Set([...prev, selectedCategory]));
    } else if (SUBCAT_CATEGORIES.includes(selectedCategory)) {
      const doc = docs.find((d) => d.category === selectedCategory && d.slug === selectedSlug);
      if (doc) {
        const sub = doc.subcategory ?? '';
        setExpandedGroups((prev) => new Set([...prev, sub]));
        setExpandedSubGroups((prev) => new Set([...prev, `${sub}::${selectedCategory}`]));
      }
    }
  }, [selectedCategory, selectedSlug, docs]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleSubGroup = (key: string) => {
    setExpandedSubGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const effectiveGroups = useMemo(() => {
    if (!filter.trim()) return expandedGroups;
    const all = new Set<string>();
    for (const { cat } of organized.flatSections) all.add(cat);
    for (const sub of organized.subcategories.keys()) all.add(sub);
    return all;
  }, [filter, organized, expandedGroups]);

  const effectiveSubGroups = useMemo(() => {
    if (!filter.trim()) return expandedSubGroups;
    const all = new Set<string>();
    for (const [sub, catMap] of organized.subcategories.entries()) {
      for (const cat of catMap.keys()) all.add(`${sub}::${cat}`);
    }
    return all;
  }, [filter, organized, expandedSubGroups]);

  if (loading) {
    return (
      <Box sx={{ p: 2, fontFamily: sidebarFont }}>
        <Typography variant="body2" color="text.secondary">Loading documentation...</Typography>
      </Box>
    );
  }

  if (docs.length === 0) {
    return (
      <Box sx={{ p: 2, fontFamily: sidebarFont }}>
        <Typography variant="body2" color="text.secondary">No documentation available for this provider.</Typography>
      </Box>
    );
  }

  const isSelected = (cat: string, slug: string) => selectedCategory === cat && selectedSlug === slug;

  const docItemSx = (selected: boolean, indent: number) => ({
    pl: `${indent * 12}px`,
    py: '4px',
    fontFamily: sidebarFont,
    borderLeft: selected ? '3px solid' : '3px solid transparent',
    borderColor: selected ? 'primary.main' : 'transparent',
    borderRadius: 0,
    '&:hover': {
      borderLeft: '3px solid',
      borderColor: selected ? 'primary.main' : 'divider',
      backgroundColor: 'action.hover',
    },
    '&.Mui-selected': {
      backgroundColor: 'action.selected',
      '&:hover': { backgroundColor: 'action.selected' },
    },
  });

  const groupHeaderSx = (indent: number) => ({
    pl: `${indent * 12}px`,
    py: '5px',
    borderLeft: '3px solid transparent',
    borderRadius: 0,
    fontFamily: sidebarFont,
    '&:hover': {
      borderLeft: '3px solid',
      borderColor: 'divider',
      backgroundColor: 'action.hover',
    },
  });

  const renderDocItem = (doc: ProviderDocEntry, indent: number, displayName?: string) => {
    const selected = isSelected(doc.category, doc.slug);
    return (
      <ListItemButton
        key={doc.id}
        selected={selected}
        onClick={() => onSelect(doc.category, doc.slug)}
        disableRipple
        sx={docItemSx(selected, indent)}
      >
        <ListItemText
          primary={
            <Typography
              sx={{
                fontFamily: sidebarFont,
                fontSize: '0.8125rem',
                fontWeight: selected ? 600 : 400,
                wordBreak: 'break-word',
                whiteSpace: 'normal',
                color: selected ? 'primary.main' : 'text.primary',
              }}
            >
              {displayName ?? doc.title}
            </Typography>
          }
        />
      </ListItemButton>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: sidebarFont }}>
      <Box sx={{ p: 1, pb: 0.5 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Filter docs..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
            sx: { fontFamily: sidebarFont, fontSize: '0.875rem' },
          }}
        />
      </Box>

      <Box sx={{ overflowY: 'auto', flex: 1, pt: 0.5 }}>
        {/* Overview docs — show provider name for index doc, title for others */}
        <List dense disablePadding>
          {organized.overview.map((doc) =>
            renderDocItem(
              doc,
              2,
              doc.slug === 'index' ? providerName : doc.title
            )
          )}
        </List>

        {/* Flat sections: Guides, Functions, Actions */}
        {organized.flatSections.map(({ cat, docs: catDocs }) => {
          const expanded = effectiveGroups.has(cat);
          return (
            <Box key={cat}>
              <ListItemButton dense disableRipple onClick={() => toggleGroup(cat)} sx={groupHeaderSx(2)}>
                <Chevron expanded={expanded} />
                <ListItemText
                  sx={{ ml: 0.5 }}
                  primary={
                    <Typography sx={{ fontFamily: sidebarFont, fontSize: '0.875rem', fontWeight: expanded ? 600 : 400 }}>
                      {FLAT_CATEGORY_LABELS[cat]}
                    </Typography>
                  }
                />
              </ListItemButton>
              <Collapse in={expanded} timeout="auto" unmountOnExit>
                <List dense disablePadding>
                  {catDocs.map((doc) => renderDocItem(doc, 3))}
                </List>
              </Collapse>
            </Box>
          );
        })}

        {/* Subcategory groups */}
        {[...organized.subcategories.entries()].map(([sub, catMap]) => {
          const subLabel = sub || 'Other';
          const isGroupExpanded = effectiveGroups.has(sub);
          const totalCount = [...catMap.values()].reduce((n, a) => n + a.length, 0);

          return (
            <Box key={sub || '__other__'}>
              <ListItemButton dense disableRipple onClick={() => toggleGroup(sub)} sx={groupHeaderSx(2)}>
                <Chevron expanded={isGroupExpanded} />
                <ListItemText
                  sx={{ ml: 0.5 }}
                  primary={
                    <Typography sx={{ fontFamily: sidebarFont, fontSize: '0.875rem', fontWeight: isGroupExpanded ? 600 : 400 }}>
                      {subLabel}
                      {!filter && (
                        <Typography component="span" sx={{ fontFamily: sidebarFont, fontSize: '0.75rem', color: 'text.disabled', ml: 0.5 }}>
                          ({totalCount})
                        </Typography>
                      )}
                    </Typography>
                  }
                />
              </ListItemButton>

              <Collapse in={isGroupExpanded} timeout="auto" unmountOnExit>
                {catMap.size === 1
                  ? [...catMap.values()].map((entries) => (
                      <List dense disablePadding key="only">
                        {entries.map((doc) => renderDocItem(doc, 3))}
                      </List>
                    ))
                  : [...catMap.entries()]
                      .sort(([a], [b]) => SUBCAT_CATEGORIES.indexOf(a) - SUBCAT_CATEGORIES.indexOf(b))
                      .map(([cat, entries]) => {
                        const subGroupKey = `${sub}::${cat}`;
                        const isSubExpanded = effectiveSubGroups.has(subGroupKey);
                        return (
                          <Box key={cat}>
                            <ListItemButton dense disableRipple onClick={() => toggleSubGroup(subGroupKey)} sx={groupHeaderSx(3)}>
                              <Chevron expanded={isSubExpanded} />
                              <ListItemText
                                sx={{ ml: 0.5 }}
                                primary={
                                  <Typography sx={{ fontFamily: sidebarFont, fontSize: '0.8125rem', fontWeight: isSubExpanded ? 600 : 400, color: 'text.secondary' }}>
                                    {SUBCAT_CATEGORY_LABELS[cat]}
                                    <Typography component="span" sx={{ fontFamily: sidebarFont, fontSize: '0.75rem', color: 'text.disabled', ml: 0.5 }}>
                                      ({entries.length})
                                    </Typography>
                                  </Typography>
                                }
                              />
                            </ListItemButton>
                            <Collapse in={isSubExpanded} timeout="auto" unmountOnExit>
                              <List dense disablePadding>
                                {entries.map((doc) => renderDocItem(doc, 4))}
                              </List>
                            </Collapse>
                          </Box>
                        );
                      })}
              </Collapse>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default ProviderDocsSidebar;
