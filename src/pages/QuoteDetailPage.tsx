import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Send, CheckCircle, XCircle, FileText, Plus, Trash2, Edit2, Package, Printer, RotateCcw, Clock, Users, ShieldAlert } from 'lucide-react';
import { Modal } from '../components/common/Modal';
import { crmService } from '../services/crmService';
import { toast, getErrorMessage, useConfirm, DetailPageTemplate, Button, Card, Badge, Alert, TextField, Textarea, Select, DataTable, IconButton, type DataTableColumn, type BadgeTone, Grid, GridItem } from '@so360/design-system';
import { Quote, QuoteLine, QuoteStatus, ProductPickerSelection, Lead } from '../types/crm';
import { INCOTERMS_2020, INCOTERM_LABELS } from '../utils/incoterms';
import { useBusinessSettings, useActivity, useShellBridge, useOrganization } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
import { ProductPickerModal } from '../components/ProductPickerModal';
import { quoteToDocumentData } from '../utils/quoteToDocumentData';
import { quoteLinePreTaxAmount, quoteTotals } from '../utils/quoteLineAmounts';
import { QuoteApprovalModal } from '../components/quotes/QuoteApprovalModal';
import { QuoteApprovalHistory, ApprovalRequestRecord } from '../components/quotes/QuoteApprovalHistory';

type QuoteLineRow = { line: QuoteLine; index: number };

const statusConfig: Record<QuoteStatus, { bg: string; text: string; label: string; tone: BadgeTone }> = {
    draft: { bg: 'bg-fg-muted/20', text: 'text-fg-subtle', label: 'Draft', tone: 'neutral' },
    pending_approval: { bg: 'bg-warning/20', text: 'text-warning', label: 'Pending Approval', tone: 'warning' },
    approved: { bg: 'bg-success/20', text: 'text-success', label: 'Approved', tone: 'success' },
    rejected: { bg: 'bg-danger/20', text: 'text-danger', label: 'Rejected', tone: 'danger' },
    converted: { bg: 'bg-primary/20', text: 'text-primary', label: 'Converted', tone: 'primary' },
    expired: { bg: 'bg-fg-muted/20', text: 'text-fg-subtle', label: 'Expired', tone: 'neutral' },
};

const QuoteDetailPage = () => {
    const [confirm, confirmDialog] = useConfirm();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const canCreateQuote = (shell?.permissionsLoaded === true) && (shell?.hasPermission?.('quotes.create') ?? false) && (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:crm:quotes:create') ?? true);
    const canApproveQuote = (shell?.permissionsLoaded === true) && (shell?.hasPermission?.('quotes.approve') ?? false) && (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:crm:quotes:approve') ?? true);
    const canConvertQuote = (shell?.permissionsLoaded === true) && (shell?.hasPermission?.('quotes.convert') ?? false) && (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:crm:quotes:convert') ?? true);

    // Use dynamic formatters from business settings
    const { settings } = useBusinessSettings();
    const { currentOrg } = useOrganization();
    const formatters = useFormatters({
        currency: settings?.base_currency || 'XXX',
        locale: settings?.document_language || 'en-US',
        timezone: settings?.timezone || 'UTC',
    });

    const [quote, setQuote] = useState<Quote | null>(null);
    // The linked customer record, resolved so the printed quotation can carry a
    // complete "Quotation To" block (address, tax registration, contact) rather
    // than the customer's name alone.
    const [customer, setCustomer] = useState<Lead | null>(null);
    // Emailing the quotation: the PDF is built server-side, so this is a real
    // attachment rather than the print dialog the Print button opens.
    const [showSendModal, setShowSendModal] = useState(false);
    const [sendTo, setSendTo] = useState('');
    const [sendMessage, setSendMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    // Editable fields
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [termsAndConditions, setTermsAndConditions] = useState('');
    const [paymentTerms, setPaymentTerms] = useState('');
    const [deliveryTerms, setDeliveryTerms] = useState('');
    const [incoterm, setIncoterm] = useState('');
    const [customerReference, setCustomerReference] = useState('');
    const [validUntil, setValidUntil] = useState('');
    const [lines, setLines] = useState<QuoteLine[]>([]);
    // Tracks raw string values while user is mid-typing in numeric fields (prevents Number() from swallowing "5." or "")
    const [draftValues, setDraftValues] = useState<Record<string, string>>({});

    // Stock availability per item_id (available_quantity)
    const [stockMap, setStockMap] = useState<Map<string, number>>(new Map());

    // Product picker modal — tracks which line is being edited (-1 = closed)
    const [pickerLineIndex, setPickerLineIndex] = useState<number>(-1);

    // Action modals
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [showConvertModal, setShowConvertModal] = useState(false);
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const [approvalHistory, setApprovalHistory] = useState<ApprovalRequestRecord[]>([]);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [withdrawReason, setWithdrawReason] = useState('');
    const [isWithdrawing, setIsWithdrawing] = useState(false);

    useEffect(() => {
        if (id) {
            fetchQuote();
        }
    }, [id]);

    // Fetch live stock whenever lines change and any have an item_id
    useEffect(() => {
        const itemIds = lines.map(l => l.item_id).filter(Boolean) as string[];
        if (itemIds.length === 0) {
            // Only reset if map isn't already empty — avoids spurious re-renders on every keystroke
            setStockMap(prev => prev.size === 0 ? prev : new Map());
            return;
        }
        crmService.getStockAvailability(itemIds).then(result => {
            const map = new Map<string, number>();
            (result.items || []).forEach(i => map.set(i.item_id, i.available_quantity));
            setStockMap(map);
        }).catch(() => {});
    }, [lines]);

    const openSendModal = () => {
        // Prefill with the address on file; the user can redirect it to a
        // procurement mailbox, which is common for B2B quotes.
        setSendTo(customer?.contact_email || '');
        setSendMessage('');
        setShowSendModal(true);
    };

    const handleSendQuote = async () => {
        if (!id) return;
        setIsSending(true);
        try {
            const result = await crmService.sendQuote(id, {
                to: sendTo.trim() || undefined,
                message: sendMessage.trim() || undefined,
            });
            if (result.sent) {
                toast.success(`Quotation emailed to ${result.to}`);
                setShowSendModal(false);
            } else {
                // The backend refuses rather than sending to nobody — surface its
                // reason instead of a generic failure.
                toast.error(result.reason || 'Could not send the quotation.');
            }
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not send the quotation.'));
        } finally {
            setIsSending(false);
        }
    };

    const fetchApprovalHistory = async (quoteId: string) => {
        try {
            const data = await crmService.getQuoteApprovalHistory(quoteId);
            setApprovalHistory(data || []);
        } catch {
            // Ignore error if approval history endpoint fails
        }
    };

    const fetchQuote = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await crmService.getQuoteById(id!);
            setQuote(data);
            setCustomer(null);
            fetchApprovalHistory(id!);
            if (data.customer_id) {
                crmService
                    .getLeadById(data.customer_id)
                    .then((c) => setCustomer(c ?? null))
                    .catch(() => {
                        // Customer deleted or not visible — the quote still prints,
                        // just without the expanded party block.
                    });
            }
            setTitle(data.title || '');
            setNotes(data.notes || '');
            setTermsAndConditions(data.terms_and_conditions || '');
            setPaymentTerms(data.payment_terms || '');
            setDeliveryTerms(data.delivery_terms || '');
            setIncoterm(data.incoterm || '');
            setCustomerReference(data.customer_reference || '');
            setValidUntil(data.valid_until ? data.valid_until.split('T')[0] : '');
            setLines((data.lines || []).map((l: any) => ({
                ...l,
                quantity: Number(l.quantity) || 0,
                unit_price: Number(l.unit_price) || 0,
                discount_percent: Number(l.discount_percent) || 0,
                tax_rate: Number(l.tax_rate) || 0,
            })));
        } catch (err: any) {
            setError(err.message || 'Failed to load quote');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!quote) return;
        setIsSaving(true);
        try {
            const updatedQuote = await crmService.updateQuote(quote.id, {
                title,
                notes,
                terms_and_conditions: termsAndConditions,
                payment_terms: paymentTerms || undefined,
                delivery_terms: deliveryTerms || undefined,
                incoterm: incoterm || undefined,
                customer_reference: customerReference || undefined,
                valid_until: validUntil || undefined,
                lines: lines.map(l => ({
                    item_id: l.item_id,
                    description: l.description,
                    quantity: l.quantity,
                    unit_price: l.unit_price,
                    discount_percent: l.discount_percent,
                    tax_rate: l.tax_rate,
                })),
            });
            setQuote(updatedQuote);
            setIsEditing(false);
            setDraftValues({});
            fetchApprovalHistory(quote.id);
            recordActivity({ eventType: 'quote.updated', eventCategory: 'crm', description: `Updated quote "${quote.quote_number || quote.id}"`, resourceType: 'quote', resourceId: quote.id }).catch(() => {});
        } catch (err: any) {
            setError(err.message || 'Failed to save quote');
        } finally {
            setIsSaving(false);
        }
    };

    const handleOpenApprovalModal = async () => {
        if (!quote) return;
        // Warn if any line exceeds available stock
        const oosLines = lines.filter(l => l.item_id && stockMap.has(l.item_id) && (stockMap.get(l.item_id) ?? 0) < l.quantity);
        if (oosLines.length > 0) {
            const names = oosLines.map(l => l.description || l.item_id).join(', ');
            if (!await confirm({ title: 'Please confirm', message: `Warning: ${oosLines.length} line item(s) may have insufficient stock (${names}). Submit anyway?`, intent: 'default', confirmLabel: 'Continue' })) return;
        }
        setShowApprovalModal(true);
    };

    const handleSubmitForApproval = async (approverUserIds: string[], notes?: string) => {
        if (!quote) return;
        try {
            const updated = await crmService.submitQuoteForApproval(quote.id, {
                approver_user_ids: approverUserIds,
                notes,
            });
            setQuote(updated);
            fetchApprovalHistory(quote.id);
            toast.success('Quote submitted for approval');
            recordActivity({ eventType: 'quote.sent', eventCategory: 'crm', description: `Submitted quote "${quote.quote_number || quote.id}" for approval`, resourceType: 'quote', resourceId: quote.id }).catch(() => {});
        } catch (err: any) {
            toast.error(getErrorMessage(err, 'Failed to submit quote for approval'));
            throw err;
        }
    };

    const handleWithdraw = async () => {
        if (!quote) return;
        setIsWithdrawing(true);
        try {
            const updated = await crmService.withdrawQuoteApproval(quote.id, withdrawReason.trim() || undefined);
            setQuote(updated);
            setShowWithdrawModal(false);
            setWithdrawReason('');
            fetchApprovalHistory(quote.id);
            toast.success('Approval request withdrawn');
            recordActivity({ eventType: 'quote.updated', eventCategory: 'crm', description: `Withdrew approval request for quote "${quote.quote_number || quote.id}"`, resourceType: 'quote', resourceId: quote.id }).catch(() => {});
        } catch (err: any) {
            toast.error(getErrorMessage(err, 'Failed to withdraw approval request'));
        } finally {
            setIsWithdrawing(false);
        }
    };

    const handleApprove = async () => {
        if (!quote) return;
        try {
            const updated = await crmService.approveQuote(quote.id);
            setQuote(updated);
            fetchApprovalHistory(quote.id);
            toast.success('Quote approved');
            recordActivity({ eventType: 'quote.accepted', eventCategory: 'crm', description: `Approved quote "${quote.quote_number || quote.id}"`, resourceType: 'quote', resourceId: quote.id }).catch(() => {});
        } catch (err: any) {
            toast.error(getErrorMessage(err, 'Failed to approve quote'));
        }
    };

    const handleReject = async () => {
        if (!quote || !rejectReason.trim()) {
            toast.error('Please provide a reason for rejection');
            return;
        }
        try {
            const updated = await crmService.rejectQuote(quote.id, rejectReason.trim());
            setQuote(updated);
            setShowRejectModal(false);
            setRejectReason('');
            fetchApprovalHistory(quote.id);
            toast.success('Quote rejected');
            recordActivity({ eventType: 'quote.rejected', eventCategory: 'crm', description: `Rejected quote "${quote.quote_number || quote.id}"`, resourceType: 'quote', resourceId: quote.id }).catch(() => {});
        } catch (err: any) {
            toast.error(getErrorMessage(err, 'Failed to reject quote'));
        }
    };

    const handleConvert = async () => {
        if (!quote) return;
        try {
            await crmService.convertQuoteToOrder(quote.id);
            setShowConvertModal(false);
            fetchQuote();
        } catch (err: any) {
            setError(err.message || 'Failed to convert quote');
        }
    };

    const handleProductSelect = (selection: ProductPickerSelection) => {
        if (pickerLineIndex < 0) return;
        const newLines = [...lines];
        newLines[pickerLineIndex] = {
            ...newLines[pickerLineIndex],
            item_id: selection.item_id,
            variant_id: selection.variant_id,
            item_name: selection.name,
            sku: selection.sku,
            sub_sku: selection.sub_sku,
            item_image_url: selection.image_url,
            unit_price: selection.unit_price,
            description: newLines[pickerLineIndex].description || selection.name,
        };
        setLines(newLines);
        setDraftValues(prev => {
            const next = { ...prev };
            delete next[`${pickerLineIndex}_unit_price`];
            return next;
        });
        setPickerLineIndex(-1);
    };

    const addLine = () => {
        setLines([
            ...lines,
            {
                description: '',
                quantity: 1,
                unit_price: 0,
                discount_percent: 0,
                tax_rate: 0,
            },
        ]);
    };

    const updateLine = (index: number, field: keyof QuoteLine, value: any) => {
        // Functional updater ensures we always mutate the latest committed state,
        // preventing stale-closure bugs when rapid keystrokes interleave with re-renders
        setLines(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const removeLine = (index: number) => {
        setLines(prev => prev.filter((_, i) => i !== index));
        // Clean up any draft values for this line
        setDraftValues(prev => {
            const next = { ...prev };
            Object.keys(next).filter(k => k.startsWith(`${index}_`)).forEach(k => delete next[k]);
            return next;
        });
    };

    const handleNumericInput = (index: number, field: keyof QuoteLine, rawValue: string) => {
        setDraftValues(prev => ({ ...prev, [`${index}_${field as string}`]: rawValue }));
        const num = parseFloat(rawValue);
        if (!isNaN(num)) updateLine(index, field, num);
    };

    const commitNumericInput = (index: number, field: keyof QuoteLine, rawValue: string, fallback: number) => {
        const num = parseFloat(rawValue);
        updateLine(index, field, isNaN(num) ? fallback : num);
        setDraftValues(prev => { const n = { ...prev }; delete n[`${index}_${field as string}`]; return n; });
    };

    // Format functions now use dynamic settings
    const formatCurrency = (value: number) => formatters.formatCurrency(value);
    const formatDate = (dateString: string) => formatters.formatDate(dateString, { year: 'numeric', month: 'long', day: 'numeric' });

    if (isLoading) {
        return (
            <div>
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-surface-raised rounded w-64" />
                    <div className="h-96 bg-surface-raised rounded" />
                </div>
            </div>
        );
    }

    if (!quote) {
        return (
            <div>
                <div className="text-center py-16">
                    <FileText className="w-16 h-16 mx-auto text-fg-subtle mb-4" />
                    <h2 className="text-xl font-semibold text-fg-subtle mb-2">Quote not found</h2>
                    <Button variant="secondary" onClick={() => navigate('/crm/quotes')}>
                        Back to Quotes
                    </Button>
                </div>
            </div>
        );
    }

    const status = statusConfig[quote.status];
    const totals = quoteTotals(lines);

    const currentUserId = shell?.user?.id;
    const currentApprovalRequest = quote.current_approval_request;
    const hasApproversList = Boolean(currentApprovalRequest?.approvers && currentApprovalRequest.approvers.length > 0);
    const isAuthorizedApprover = hasApproversList
        ? Boolean(currentApprovalRequest?.approvers?.some((a: any) => a.approver_user_id === currentUserId && a.status === 'pending'))
        : true;
    const canApprove = quote.status === 'pending_approval' && canApproveQuote && isAuthorizedApprover;
    const isSubmitter = Boolean(
        currentUserId && (
            quote.submitted_by === currentUserId ||
            (quote.created_by as any)?.id === currentUserId ||
            (quote as any).created_by === currentUserId ||
            currentApprovalRequest?.requested_by === currentUserId
        )
    );
    const canWithdraw = quote.status === 'pending_approval' && isSubmitter;
    const canEdit = (quote.status === 'draft' || quote.status === 'rejected');
    const canSubmit = (quote.status === 'draft' || quote.status === 'rejected') && lines.length > 0;
    const canConvert = quote.status === 'approved';

    const handlePrint = () => shell?.printDocument?.('sales_quote', quoteToDocumentData(quote, {
        currency: settings?.base_currency || 'XXX',
        seller: {
            name: currentOrg?.name || '',
            address: (currentOrg as any)?.billing_address
                ? [
                    (currentOrg as any).billing_address.street,
                    (currentOrg as any).billing_address.city,
                    (currentOrg as any).billing_address.country,
                  ].filter(Boolean).join(', ')
                : undefined,
            tax_number: (currentOrg as any)?.tax_id,
            pan: (currentOrg as any)?.pan,
        },
        customer,
        // Compared against the buyer's state to decide
        // whether the supply is intra- or inter-state.
        sellerState: (currentOrg as any)?.billing_address?.state,
        sellerCountry: (currentOrg as any)?.billing_address?.country,
    }));

    // Header actions: one primary (first available by priority), at most 2
    // secondaries, everything else (print, reject) in the overflow menu.
    const act = {
        save: isEditing ? (
            <Button key="save" onClick={handleSave} disabled={isSaving}><Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save'}
            </Button>
        ) : null,
        approve: canApproveQuote && canApprove ? (
            <Button key="approve" onClick={handleApprove}><CheckCircle className="w-4 h-4" />Approve</Button>
        ) : null,
        submit: canSubmit && !isEditing ? (
            <Button key="submit" onClick={handleOpenApprovalModal}><Send className="w-4 h-4" />Submit for Approval</Button>
        ) : null,
        convert: canConvertQuote && canConvert ? (
            <Button key="convert" onClick={() => setShowConvertModal(true)}><FileText className="w-4 h-4" />Convert to Order</Button>
        ) : null,
        email: !isEditing ? (
            <Button key="email" onClick={openSendModal}><Send className="w-4 h-4" />Email to Customer</Button>
        ) : null,
    };
    const primaryKey = (['save', 'approve', 'submit', 'convert', 'email'] as const).find(k => act[k]);
    const doCancel = () => { setIsEditing(false); setDraftValues({}); fetchQuote(); };
    const secondaryCandidates: Array<{ label: string; onSelect: () => void; icon: React.ReactNode }> = [
        ...(isEditing ? [{ label: 'Cancel', onSelect: doCancel, icon: null }] : []),
        ...(canCreateQuote && canEdit && !isEditing ? [{ label: 'Edit', onSelect: () => setIsEditing(true), icon: <Edit2 className="w-4 h-4" /> }] : []),
        ...(canWithdraw && !isEditing ? [{ label: 'Withdraw Request', onSelect: () => setShowWithdrawModal(true), icon: <RotateCcw className="w-4 h-4" /> }] : []),
        ...(!isEditing && primaryKey !== 'email' ? [{ label: 'Email to Customer', onSelect: openSendModal, icon: <Send className="w-4 h-4" /> }] : []),
    ];
    const secondaryActions = secondaryCandidates.slice(0, 2).map(c => (
        <Button key={c.label} variant="secondary" onClick={c.onSelect}>{c.icon}{c.label}</Button>
    ));
    const overflowActions = [
        ...secondaryCandidates.slice(2).map(c => ({ label: c.label, onSelect: c.onSelect })),
        ...(canApproveQuote && canApprove ? [{ label: 'Reject', danger: true, onSelect: () => setShowRejectModal(true) }] : []),
        ...(!isEditing ? [{ label: 'Print Quote', onSelect: handlePrint }] : []),
    ];

    return (
        <DetailPageTemplate
            trail={[{ label: 'Quotes', to: '/crm/quotes' }]}
            title={quote.quote_number || `Quote #${quote.id.slice(0, 8)}`}
            status={
                <Badge size="sm" tone={status.tone}>{status.label}</Badge>
            }
            meta={
                <p className="text-fg-subtle">
                    Created {formatDate(quote.created_at)}
                    {quote.valid_until && ` • Valid until ${formatDate(quote.valid_until)}`}
                </p>
            }
            primaryAction={primaryKey ? act[primaryKey] : undefined}
            sidePanel={
                <div className="flex flex-col gap-nb-3">
                        <Card title="Summary">
                            <div className="space-y-4">
                                <div>
                                    <span className="text-sm text-fg-subtle">Grand Total</span>
                                    <p className="text-2xl font-bold text-fg">{formatCurrency(totals.grandTotal)}</p>
                                </div>
                                <Grid gap="md" className="pt-4 border-t border-line">
                                    <GridItem span={{ md: 4, lg: 6 }}><div>
                                        <span className="text-sm text-fg-subtle">Items</span>
                                        <p className="text-lg font-semibold text-fg">{lines.length}</p>
                                    </div></GridItem>
                                    <GridItem span={{ md: 4, lg: 6 }}><div>
                                        <span className="text-sm text-fg-subtle">Status</span>
                                        <p className={`text-lg font-semibold ${status.text}`}>{status.label}</p>
                                    </div></GridItem>
                                </Grid>
                            </div>
                        </Card>
    
                        {/* The customer the quote is raised for — resolved from the deal
                            when the quote was created. Read-only here: the record lives
                            in Customers, and a quote must reference it rather than keep
                            its own divergent copy. */}
                        {customer && (
                            <Card title="Customer">
                                <Button
                                    variant="secondary"
                                    onClick={() => navigate(`/crm/customers/${customer.id}`)}
                                    className="w-full justify-start text-left"
                                >
                                    <p className="font-medium text-fg">
                                        {customer.company_name || customer.contact_name || '—'}
                                    </p>
                                    {customer.company_name && customer.contact_name && (
                                        <p className="text-sm text-fg-subtle">{customer.contact_name}</p>
                                    )}
                                </Button>
                                <div className="mt-4 space-y-2 text-sm">
                                    {customer.contact_email && (
                                        <div className="flex justify-between gap-3">
                                            <span className="text-fg-subtle">Email</span>
                                            <span className="text-fg-subtle truncate">{customer.contact_email}</span>
                                        </div>
                                    )}
                                    {customer.phone && (
                                        <div className="flex justify-between gap-3">
                                            <span className="text-fg-subtle">Phone</span>
                                            <span className="text-fg-subtle">{customer.phone}</span>
                                        </div>
                                    )}
                                    {customer.tax_id && (
                                        <div className="flex justify-between gap-3">
                                            <span className="text-fg-subtle">Tax ID</span>
                                            <span className="text-fg-subtle truncate">{customer.tax_id}</span>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        )}
    
                        {quote.deal && (
                            <Card title="Related Deal">
                                <Button
                                    variant="secondary"
                                    onClick={() => navigate(`/crm/deal/${quote.deal_id}`)}
                                    className="w-full text-left justify-start"
                                >
                                    <p className="font-medium text-fg">{quote.deal.name}</p>
                                    <p className="text-sm text-fg-subtle">{quote.deal.company_name}</p>
                                </Button>
                            </Card>
                        )}
    
                        {quote.rejection_reason && (
                            <Card title="Rejection Reason">
                                <p className="text-sm text-danger">{quote.rejection_reason}</p>
                            </Card>
                        )}
                    </div>
            }
            secondaryActions={secondaryActions}
            overflowActions={overflowActions}
        >
            {confirmDialog}

            {error && (
                <div className="mb-4 p-4 bg-danger/20 border border-danger/50 rounded-lg text-danger">
                    {error}
                </div>
            )}

            {/* Approval in Progress Banner */}
            {quote.status === 'pending_approval' && (
                <Alert variant="warning" title="Approval in Progress" className="mb-nb-3">
                    <div className="flex flex-col gap-nb-2">
                        <p className="text-sm text-fg-muted">
                            <Badge size="sm" tone="warning">Locked</Badge>{' '}
                            This quote is currently undergoing approval review. Material details and line items cannot be modified until a decision is reached or the request is withdrawn.
                            {isSubmitter && !isAuthorizedApprover && (
                                <span className="block mt-1 text-xs text-warning font-medium">
                                    You submitted this quote. Self-review is not permitted.
                                </span>
                            )}
                            {isAuthorizedApprover && (
                                <span className="block mt-1 text-xs text-success font-medium">
                                    You are an assigned reviewer for this quote. Please examine the commercial terms using the action buttons above.
                                </span>
                            )}
                        </p>
                        {currentApprovalRequest?.approvers && currentApprovalRequest.approvers.length > 0 && (
                            <div className="flex flex-wrap gap-nb-2 items-center">
                                <span className="text-xs font-semibold text-fg-muted">Required Approvers:</span>
                                {currentApprovalRequest.approvers.map((a: any, idx: number) => (
                                    <Badge
                                        key={a.id || idx}
                                        size="sm"
                                        tone={a.status === 'approved' ? 'success' : a.status === 'rejected' ? 'danger' : 'neutral'}
                                    >
                                        <span className="font-medium">{a.approver_name || a.approver_email || 'Approver'}</span>{' '}
                                        <span>({a.status})</span>
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>
                </Alert>
            )}

            {/* Quote Details */}
            <div>
                <div className="flex flex-col gap-nb-3">
                    {/* Basic Info */}
                    <Card title="Quote Details">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-fg-subtle mb-1">Title</label>
                                {isEditing ? (
                                    <TextField
                                        name="quote-title"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Enter quote title..."
                                    />
                                ) : (
                                    <p className="text-fg">{quote.title || 'Untitled Quote'}</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-fg-subtle mb-1">Valid Until</label>
                                {isEditing ? (
                                    <TextField
                                        name="quote-valid-until"
                                        type="date"
                                        value={validUntil}
                                        onChange={(e) => setValidUntil(e.target.value)}
                                    />
                                ) : (
                                    <p className="text-fg">
                                        {quote.valid_until ? formatDate(quote.valid_until) : 'Not set'}
                                    </p>
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* Line Items */}
                    <Card title="Line Items" actions={canCreateQuote && isEditing ? (<Button variant="secondary" onClick={addLine}><Plus className="w-4 h-4" />Add Line</Button>) : undefined}>
                        <DataTable<QuoteLineRow>
                            name="quote-lines"
                            data-testid="quote-lines"
                            rows={lines.map((line, index) => ({ line, index }))}
                            rowKey={(r) => r.line.id || `new-${r.index}`}
                            emptyState={<span className="text-fg-subtle">No line items added yet</span>}
                            columns={[
                                {
                                    key: 'description',
                                    header: 'Description',
                                    render: ({ line, index }) => isEditing ? (
                                        <div className="space-y-1.5">
                                            {/* Product selector button */}
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                onClick={() => setPickerLineIndex(index)}
                                                className="w-full justify-start text-left"
                                            >
                                                {line.item_image_url ? (
                                                    <img src={line.item_image_url} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
                                                ) : (
                                                    <Package className="w-4 h-4 text-fg-muted flex-shrink-0" />
                                                )}
                                                {line.item_name ? (
                                                    <span className="flex-1 min-w-0">
                                                        <span className="text-fg truncate block">{line.item_name}</span>
                                                        <span className="flex items-center gap-1 mt-0.5">
                                                            <span className="text-xs px-1.5 py-0.5 bg-fg-muted/20 text-fg-subtle rounded">{line.sku}</span>
                                                            {line.sub_sku && line.sub_sku !== 'NIL' && (
                                                                <span className="text-xs px-1.5 py-0.5 bg-primary/50 text-primary rounded">{line.sub_sku}</span>
                                                            )}
                                                        </span>
                                                    </span>
                                                ) : (
                                                    <span className="text-fg-muted">Select product...</span>
                                                )}
                                            </Button>
                                            {/* Free-text description */}
                                            <TextField
                                                name={`quote-line-${index}-description`}
                                                value={line.description}
                                                onChange={(e) => updateLine(index, 'description', e.target.value)}
                                                placeholder="Description / notes..."
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex items-start gap-2">
                                            {line.item_image_url && (
                                                <img src={line.item_image_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0 mt-0.5" />
                                            )}
                                            <div className="min-w-0">
                                                <span className="text-fg block">{line.description}</span>
                                                {line.sku && (
                                                    <span className="flex items-center gap-1 mt-0.5">
                                                        <span className="text-xs px-1.5 py-0.5 bg-fg-muted/20 text-fg-subtle rounded">{line.sku}</span>
                                                        {line.sub_sku && line.sub_sku !== 'NIL' && (
                                                            <span className="text-xs px-1.5 py-0.5 bg-primary/40 text-primary rounded">{line.sub_sku}</span>
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ),
                                },
                                {
                                    key: 'stock',
                                    header: 'Stock',
                                    render: ({ line }) => {
                                        const stock = line.item_id ? stockMap.get(line.item_id) : undefined;
                                        const isLowStock = stock !== undefined && stock > 0 && stock < line.quantity;
                                        const isOOS = stock !== undefined && stock <= 0;
                                        return line.item_id ? (
                                            stock === undefined ? (
                                                <span className="text-xs text-fg-muted">—</span>
                                            ) : isOOS ? (
                                                <span className="text-xs font-medium text-danger bg-danger/10 px-2 py-0.5 rounded">OOS</span>
                                            ) : isLowStock ? (
                                                <span className="text-xs font-medium text-warning bg-warning/10 px-2 py-0.5 rounded">{stock} avail</span>
                                            ) : (
                                                <span className="text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded">{stock} avail</span>
                                            )
                                        ) : (
                                            <span className="text-xs text-fg-subtle">—</span>
                                        );
                                    },
                                },
                                {
                                    key: 'quantity',
                                    header: 'Qty',
                                    align: 'right',
                                    render: ({ line, index }) => isEditing ? (
                                        <TextField
                                            name={`quote-line-${index}-quantity`}
                                            type="text"
                                            inputMode="numeric"
                                            value={draftValues[`${index}_quantity`] ?? String(line.quantity)}
                                            onChange={(e) => handleNumericInput(index, 'quantity', e.target.value)}
                                            onBlur={(e) => commitNumericInput(index, 'quantity', e.target.value, 1)}
                                        />
                                    ) : (
                                        <span className="text-fg">{line.quantity}</span>
                                    ),
                                },
                                {
                                    key: 'unit_price',
                                    header: 'Unit Price',
                                    align: 'right',
                                    render: ({ line, index }) => isEditing ? (
                                        <TextField
                                            name={`quote-line-${index}-unit_price`}
                                            type="text"
                                            inputMode="decimal"
                                            value={draftValues[`${index}_unit_price`] ?? String(line.unit_price)}
                                            onChange={(e) => handleNumericInput(index, 'unit_price', e.target.value)}
                                            onBlur={(e) => commitNumericInput(index, 'unit_price', e.target.value, 0)}
                                        />
                                    ) : (
                                        <span className="text-fg">{formatCurrency(line.unit_price)}</span>
                                    ),
                                },
                                {
                                    key: 'discount_percent',
                                    header: 'Disc %',
                                    align: 'right',
                                    render: ({ line, index }) => isEditing ? (
                                        <TextField
                                            name={`quote-line-${index}-discount_percent`}
                                            type="text"
                                            inputMode="decimal"
                                            value={draftValues[`${index}_discount_percent`] ?? String(line.discount_percent || 0)}
                                            onChange={(e) => handleNumericInput(index, 'discount_percent', e.target.value)}
                                            onBlur={(e) => commitNumericInput(index, 'discount_percent', e.target.value, 0)}
                                        />
                                    ) : (
                                        <span className="text-fg-subtle">{line.discount_percent || 0}%</span>
                                    ),
                                },
                                {
                                    key: 'tax_rate',
                                    header: 'Tax %',
                                    align: 'right',
                                    render: ({ line, index }) => isEditing ? (
                                        <TextField
                                            name={`quote-line-${index}-tax_rate`}
                                            type="text"
                                            inputMode="decimal"
                                            value={draftValues[`${index}_tax_rate`] ?? String(line.tax_rate || 0)}
                                            onChange={(e) => handleNumericInput(index, 'tax_rate', e.target.value)}
                                            onBlur={(e) => commitNumericInput(index, 'tax_rate', e.target.value, 0)}
                                        />
                                    ) : (
                                        <span className="text-fg-subtle">{line.tax_rate || 0}%</span>
                                    ),
                                },
                                {
                                    key: 'amount',
                                    header: 'Amount',
                                    align: 'right',
                                    render: ({ line }) => (
                                        <span className="text-fg font-medium" data-testid="quote-line-amount">
                                            {formatCurrency(quoteLinePreTaxAmount(line))}
                                        </span>
                                    ),
                                },
                                ...(isEditing ? [{
                                    key: 'actions',
                                    header: '',
                                    render: ({ index }: QuoteLineRow) => (
                                        <IconButton label={`Remove line ${index + 1}`} variant="danger" icon={<Trash2 className="w-4 h-4" />} onClick={() => removeLine(index)} />
                                    ),
                                }] : []),
                            ] as DataTableColumn<QuoteLineRow>[]}
                        />

                        {/* Totals */}
                        <div className="mt-6 pt-4 border-t border-line">
                            <div className="flex justify-end">
                                <div className="w-64 space-y-2">
                                    <div className="flex justify-between text-fg-subtle">
                                        <span>Subtotal</span>
                                        <span>{formatCurrency(totals.subtotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-fg-subtle">
                                        <span>Discount</span>
                                        <span>-{formatCurrency(totals.discountTotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-fg-subtle">
                                        <span>Tax</span>
                                        <span>{formatCurrency(totals.taxTotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-lg font-semibold text-fg pt-2 border-t border-line">
                                        <span>Total</span>
                                        <span>{formatCurrency(totals.grandTotal)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Notes & Terms */}
                    <Card title="Notes & Terms">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-fg-subtle mb-1">Notes</label>
                                {isEditing ? (
                                    <Textarea
                                        name="quote-notes"
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        rows={3}
                                        placeholder="Add any notes..."
                                    />
                                ) : (
                                    <p className="text-fg-subtle">{quote.notes || 'No notes'}</p>
                                )}
                            </div>
                            <Grid gap="md">
                                <GridItem span={{ md: 4, lg: 6 }}><div>
                                    <label className="block text-sm font-medium text-fg-subtle mb-1">Payment Terms</label>
                                    {isEditing ? (
                                        <TextField
                                            name="quote-payment-terms"
                                            value={paymentTerms}
                                            onChange={(e) => setPaymentTerms(e.target.value)}
                                            placeholder="e.g. Net 30"
                                        />
                                    ) : (
                                        <p className="text-fg-subtle">{quote.payment_terms || '—'}</p>
                                    )}
                                </div></GridItem>
                                <GridItem span={{ md: 4, lg: 6 }}><div>
                                    <label className="block text-sm font-medium text-fg-subtle mb-1">Customer Reference</label>
                                    {isEditing ? (
                                        <TextField
                                            name="quote-customer-reference"
                                            value={customerReference}
                                            onChange={(e) => setCustomerReference(e.target.value)}
                                            placeholder="Buyer's RFQ / PO number"
                                        />
                                    ) : (
                                        <p className="text-fg-subtle">{quote.customer_reference || '—'}</p>
                                    )}
                                </div></GridItem>
                                <GridItem span={{ md: 4, lg: 6 }}><div>
                                    <label className="block text-sm font-medium text-fg-subtle mb-1">Delivery Terms</label>
                                    {isEditing ? (
                                        <TextField
                                            name="quote-delivery-terms"
                                            value={deliveryTerms}
                                            onChange={(e) => setDeliveryTerms(e.target.value)}
                                            placeholder="e.g. Ex-stock, 2-3 weeks from PO"
                                        />
                                    ) : (
                                        <p className="text-fg-subtle">{quote.delivery_terms || '—'}</p>
                                    )}
                                </div></GridItem>
                                <GridItem span={{ md: 4, lg: 6 }}><div>
                                    <label className="block text-sm font-medium text-fg-subtle mb-1">
                                        Incoterm <span className="text-fg-muted font-normal">(Incoterms&reg; 2020)</span>
                                    </label>
                                    {isEditing ? (
                                        <Select
                                            name="quote-incoterm"
                                            aria-label="Incoterm"
                                            value={incoterm}
                                            options={[{ value: '', label: 'Not specified' }, ...INCOTERMS_2020.map((t) => ({ value: t.code, label: `${t.code} — ${t.label}` }))]}
                                            onChange={(e) => setIncoterm(e.target.value)}
                                        />
                                    ) : (
                                        <p className="text-fg-subtle">
                                            {quote.incoterm
                                                ? `${quote.incoterm} — ${INCOTERM_LABELS[quote.incoterm] ?? ''}`.trim()
                                                : '—'}
                                        </p>
                                    )}
                                </div></GridItem>
                            </Grid>
                            <div>
                                <label className="block text-sm font-medium text-fg-subtle mb-1">Terms & Conditions</label>
                                {isEditing ? (
                                    <Textarea
                                        name="quote-terms"
                                        value={termsAndConditions}
                                        onChange={(e) => setTermsAndConditions(e.target.value)}
                                        rows={4}
                                        placeholder="Add terms and conditions..."
                                    />
                                ) : (
                                    <p className="text-fg-subtle whitespace-pre-wrap">
                                        {quote.terms_and_conditions || 'No terms specified'}
                                    </p>
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* Approval History Audit Trail */}
                    <QuoteApprovalHistory
                        history={approvalHistory}
                        currentRequestId={quote.current_approval_request_id}
                        formatDate={formatDate}
                        formatCurrency={formatCurrency}
                    />
                </div>
            </div>

            {/* Product Picker Modal */}
            <ProductPickerModal
                isOpen={pickerLineIndex >= 0}
                onClose={() => setPickerLineIndex(-1)}
                onSelect={handleProductSelect}
            />

            {/* Reject Modal */}
            {showRejectModal && (
                <Modal
                    isOpen
                    size="md"
                    title="Reject Quote"
                    data-testid="reject-quote-modal"
                    onClose={() => { setShowRejectModal(false); setRejectReason(''); }}
                    footer={
                        <>
                            <Button type="button" variant="secondary" onClick={() => { setShowRejectModal(false); setRejectReason(''); }}>
                                Cancel
                            </Button>
                            <Button type="button" variant="danger" onClick={handleReject} disabled={!rejectReason}>
                                Reject Quote
                            </Button>
                        </>
                    }
                >
                    <label className="block text-sm font-medium text-fg-subtle mb-2">
                        Reason for rejection *
                    </label>
                    <Textarea
                        name="quote-reject-reason"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={4}
                        placeholder="Please provide a reason..."
                    />
                </Modal>
            )}

            {/* Convert Modal */}
            {showConvertModal && (
                <Modal
                    isOpen
                    size="md"
                    title="Convert to Sales Order"
                    data-testid="convert-quote-modal"
                    onClose={() => setShowConvertModal(false)}
                    footer={
                        <>
                            <Button type="button" variant="secondary" onClick={() => setShowConvertModal(false)}>
                                Cancel
                            </Button>
                            <Button type="button" variant="primary" onClick={handleConvert}>
                                Convert to Order
                            </Button>
                        </>
                    }
                >
                    <p className="text-fg-subtle">
                        This will convert the approved quote to a sales order. This action cannot be undone.
                    </p>
                </Modal>
            )}

            <Modal
                isOpen={showSendModal}
                onClose={() => setShowSendModal(false)}
                dismissible={!isSending}
                title="Email quotation to customer"
                size="lg"
                data-testid="send-quote-modal"
                footer={
                    <>
                        <Button type="button" variant="secondary" onClick={() => setShowSendModal(false)} disabled={isSending}>
                            Cancel
                        </Button>
                        <Button type="button" variant="primary" onClick={handleSendQuote} disabled={isSending || !sendTo.trim()}>
                            <Send className="w-4 h-4" />
                            {isSending ? 'Sending…' : 'Send quotation'}
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <p className="text-sm text-fg-subtle">
                        The quotation PDF is generated and attached automatically.
                    </p>
                    <div>
                        <label className="block text-sm font-medium text-fg-subtle mb-1">Send to</label>
                        <TextField
                            name="quote-send-to"
                            type="email"
                            value={sendTo}
                            onChange={(e) => setSendTo(e.target.value)}
                            placeholder="customer@example.com"
                        />
                        {!customer?.contact_email && (
                            <p className="mt-1 text-xs text-warning">
                                This quote has no linked customer email — enter an address to send it.
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-fg-subtle mb-1">
                            Message <span className="text-fg-muted font-normal">(optional)</span>
                        </label>
                        <Textarea
                            name="quote-send-message"
                            value={sendMessage}
                            onChange={(e) => setSendMessage(e.target.value)}
                            rows={3}
                            placeholder="As discussed, please find our quotation attached."
                        />
                    </div>
                </div>
            </Modal>

            {/* Withdraw Modal */}
            {showWithdrawModal && (
                <Modal
                    isOpen
                    size="md"
                    dismissible={!isWithdrawing}
                    data-testid="withdraw-approval-modal"
                    title={
                        <span className="flex items-center gap-2">
                            <RotateCcw className="w-5 h-5 text-warning" />
                            Withdraw Approval Request
                        </span>
                    }
                    onClose={() => { setShowWithdrawModal(false); setWithdrawReason(''); }}
                    footer={
                        <>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => { setShowWithdrawModal(false); setWithdrawReason(''); }}
                                disabled={isWithdrawing}
                            >
                                Cancel
                            </Button>
                            <Button type="button" variant="primary" onClick={handleWithdraw} disabled={isWithdrawing}>
                                <RotateCcw className="w-4 h-4" />
                                {isWithdrawing ? 'Withdrawing...' : 'Confirm Withdrawal'}
                            </Button>
                        </>
                    }
                >
                    <p className="text-sm text-fg-subtle mb-4 leading-relaxed">
                        This will cancel the active approval cycle and return this quote to <strong>Draft</strong> status, unlocking it for edits and resubmission.
                    </p>
                    <label className="block text-sm font-medium text-fg-subtle mb-1.5">
                        Reason for withdrawal <span className="text-fg-muted font-normal">(optional)</span>
                    </label>
                    <Textarea
                        name="quote-withdraw-reason"
                        value={withdrawReason}
                        onChange={(e) => setWithdrawReason(e.target.value)}
                        rows={3}
                        placeholder="e.g. Updating line item quantities or pricing..."
                    />
                </Modal>
            )}

            {/* Quote Approval Modal (Approver Selection & Submission) */}
            <QuoteApprovalModal
                quote={quote}
                currentUserId={currentUserId}
                currencyFormatter={formatCurrency}
                isOpen={showApprovalModal}
                onClose={() => setShowApprovalModal(false)}
                onSubmit={handleSubmitForApproval}
            />
        </DetailPageTemplate>
    );
};

export default QuoteDetailPage;
