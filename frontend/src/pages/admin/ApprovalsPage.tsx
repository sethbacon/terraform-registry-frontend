import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Container,
  Typography,
  Grid,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { apiClient } from '../../services/api';

interface ApprovalRequest {
  id: string;
  mirror_config_id: string;
  organization_id?: string;
  provider_namespace: string;
  provider_name?: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewer_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
}

const ApprovalsPage: React.FC = () => {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    mirror_config_id: '',
    provider_namespace: '',
    provider_name: '',
    reason: '',
  });

  // Review dialog state
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewingApproval, setReviewingApproval] = useState<ApprovalRequest | null>(null);
  const [reviewForm, setReviewForm] = useState<{
    status: 'approved' | 'rejected';
    notes: string;
  }>({ status: 'approved', notes: '' });
  const [reviewing, setReviewing] = useState(false);

  // Status filter
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    loadApprovals();
  }, [statusFilter]);

  const loadApprovals = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.listApprovalRequests(
        statusFilter ? { status: statusFilter } : undefined
      );
      setApprovals(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load approval requests');
      console.error('Error loading approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      setError(null);
      await apiClient.createApprovalRequest({
        mirror_config_id: createForm.mirror_config_id,
        provider_namespace: createForm.provider_namespace,
        provider_name: createForm.provider_name || undefined,
        reason: createForm.reason || undefined,
      });
      setCreateDialogOpen(false);
      setCreateForm({ mirror_config_id: '', provider_namespace: '', provider_name: '', reason: '' });
      setSuccess('Approval request created successfully');
      await loadApprovals();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create approval request');
    }
  };

  const handleReview = async () => {
    if (!reviewingApproval) return;
    try {
      setReviewing(true);
      setError(null);
      await apiClient.reviewApproval(reviewingApproval.id, {
        status: reviewForm.status,
        notes: reviewForm.notes || undefined,
      });
      setReviewDialogOpen(false);
      setReviewingApproval(null);
      setReviewForm({ status: 'approved', notes: '' });
      setSuccess(`Approval request ${reviewForm.status}`);
      await loadApprovals();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to review approval request');
    } finally {
      setReviewing(false);
    }
  };

  const openReviewDialog = (approval: ApprovalRequest, defaultStatus: 'approved' | 'rejected') => {
    setReviewingApproval(approval);
    setReviewForm({ status: defaultStatus, notes: '' });
    setReviewDialogOpen(true);
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'approved':
        return <Chip label="Approved" size="small" color="success" icon={<CheckCircleIcon />} />;
      case 'rejected':
        return <Chip label="Rejected" size="small" color="error" icon={<CancelIcon />} />;
      case 'pending':
      default:
        return <Chip label="Pending" size="small" color="warning" icon={<HourglassEmptyIcon />} />;
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4">Approval Requests</Typography>
          <Typography variant="body2" color="text.secondary">
            Review and manage mirror provider approval requests
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="approved">Approved</MenuItem>
              <MenuItem value="rejected">Rejected</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadApprovals}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Create Request
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        {approvals.map((approval) => (
          <Grid item xs={12} md={6} key={approval.id}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                  <Typography variant="h6" sx={{ wordBreak: 'break-word', flex: 1, mr: 1 }}>
                    {approval.provider_namespace}
                    {approval.provider_name ? `/${approval.provider_name}` : ''}
                  </Typography>
                  {getStatusChip(approval.status)}
                </Box>

                {approval.reason && (
                  <Typography variant="body2" color="textSecondary" paragraph>
                    {approval.reason}
                  </Typography>
                )}

                <Typography variant="caption" color="textSecondary" display="block">
                  <strong>Mirror Config ID:</strong> {approval.mirror_config_id}
                </Typography>
                <Typography variant="caption" color="textSecondary" display="block">
                  <strong>Created:</strong> {formatDate(approval.created_at)}
                </Typography>

                {approval.reviewed_at && (
                  <>
                    <Typography variant="caption" color="textSecondary" display="block">
                      <strong>Reviewed:</strong> {formatDate(approval.reviewed_at)}
                    </Typography>
                    {approval.reviewer_notes && (
                      <Typography variant="caption" color="textSecondary" display="block">
                        <strong>Notes:</strong> {approval.reviewer_notes}
                      </Typography>
                    )}
                  </>
                )}
              </CardContent>

              {approval.status === 'pending' && (
                <CardActions>
                  <Button
                    size="small"
                    color="success"
                    variant="outlined"
                    startIcon={<CheckCircleIcon />}
                    onClick={() => openReviewDialog(approval, 'approved')}
                  >
                    Approve
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    startIcon={<CancelIcon />}
                    onClick={() => openReviewDialog(approval, 'rejected')}
                  >
                    Reject
                  </Button>
                </CardActions>
              )}
            </Card>
          </Grid>
        ))}

        {approvals.length === 0 && !loading && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="body1" color="textSecondary" align="center">
                  No approval requests found.
                  {statusFilter && ` Try clearing the "${statusFilter}" filter.`}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Create Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create Approval Request</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Mirror Config ID"
              fullWidth
              required
              value={createForm.mirror_config_id}
              onChange={(e) => setCreateForm({ ...createForm, mirror_config_id: e.target.value })}
              helperText="The ID of the mirror configuration to request access for"
            />
            <TextField
              label="Provider Namespace"
              fullWidth
              required
              value={createForm.provider_namespace}
              onChange={(e) => setCreateForm({ ...createForm, provider_namespace: e.target.value })}
              helperText="e.g., hashicorp"
            />
            <TextField
              label="Provider Name"
              fullWidth
              value={createForm.provider_name}
              onChange={(e) => setCreateForm({ ...createForm, provider_name: e.target.value })}
              helperText="Optional — leave blank to request access to all providers in the namespace"
            />
            <TextField
              label="Reason"
              fullWidth
              multiline
              rows={3}
              value={createForm.reason}
              onChange={(e) => setCreateForm({ ...createForm, reason: e.target.value })}
              helperText="Explain why access is needed"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!createForm.mirror_config_id || !createForm.provider_namespace}
          >
            Submit Request
          </Button>
        </DialogActions>
      </Dialog>

      {/* Review Dialog */}
      <Dialog
        open={reviewDialogOpen}
        onClose={() => setReviewDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Review Approval Request</DialogTitle>
        <DialogContent>
          {reviewingApproval && (
            <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body2">
                <strong>Provider:</strong> {reviewingApproval.provider_namespace}
                {reviewingApproval.provider_name ? `/${reviewingApproval.provider_name}` : ''}
              </Typography>
              {reviewingApproval.reason && (
                <Typography variant="body2">
                  <strong>Reason:</strong> {reviewingApproval.reason}
                </Typography>
              )}
              <FormControl fullWidth>
                <InputLabel>Decision</InputLabel>
                <Select
                  label="Decision"
                  value={reviewForm.status}
                  onChange={(e) =>
                    setReviewForm({ ...reviewForm, status: e.target.value as 'approved' | 'rejected' })
                  }
                >
                  <MenuItem value="approved">Approve</MenuItem>
                  <MenuItem value="rejected">Reject</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Notes"
                fullWidth
                multiline
                rows={3}
                value={reviewForm.notes}
                onChange={(e) => setReviewForm({ ...reviewForm, notes: e.target.value })}
                helperText="Optional notes for the requester"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewDialogOpen(false)} disabled={reviewing}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={reviewForm.status === 'approved' ? 'success' : 'error'}
            onClick={handleReview}
            disabled={reviewing}
          >
            {reviewing ? 'Submitting...' : reviewForm.status === 'approved' ? 'Approve' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ApprovalsPage;
