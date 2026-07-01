import React, { useEffect, useState, useMemo } from 'react';

// Subcomponents and Modals
import WhatsAppAdminPanel from './components/modals/WhatsAppAdminPanel.jsx';
import BlockFiltersModal from './components/modals/BlockFiltersModal.jsx';
import VolunteersModal from './components/modals/VolunteersModal.jsx';
import WhatsAppAlertModal from './components/modals/WhatsAppAlertModal.jsx';
import RequestDetailsModal from './components/modals/RequestDetailsModal.jsx';

// Views
import DashboardView from './components/views/DashboardView.jsx';
import RequestView from './components/views/RequestView.jsx';
import RecentRequestsView from './components/views/RecentRequestsView.jsx';
import DonorsView from './components/views/DonorsView.jsx';
import LogsView from './components/views/LogsView.jsx';
import ManagerDashboardView from './components/views/ManagerDashboardView.jsx';
import ManagerAddAccountView from './components/views/ManagerAddAccountView.jsx';
import VolunteerAddAccountView from './components/views/VolunteerAddAccountView.jsx';
import ManagerLoginView from './components/views/ManagerLoginView.jsx';
import ForgotPasswordPage from './components/views/ForgotPasswordPage.jsx';
import VolunteerForgotPasswordPage from './components/views/VolunteerForgotPasswordPage.jsx';
import VolunteerLoginView from './components/views/VolunteerLoginView.jsx';

// Utilities
import { MOCK_DONORS, MOCK_REQUESTS, NAV } from './utils/constants.js';
import { getPathState, formatISTDateTime } from './utils/helpers.js';
import {
  readPersistedSheet,
  readManagerAccounts,
  readVolunteerAccounts,
  deleteVolunteerAccount,
  sendDonorWhatsAppAlert,
  sendBrowserNotification
} from './utils/api.js';

export default function App() {
  const pathState = getPathState();
  const [view, setView] = useState(() => {
    if (pathState.view === 'manager') return 'manager';
    if (pathState.view === 'add-manager') return 'add-manager';
    return 'dashboard';
  });
  const [donors, setDonors] = useState(MOCK_DONORS);
  const [requests, setRequests] = useState(MOCK_REQUESTS);
  const [blockedFilters, setBlockedFilters] = useState({ admissionPrefixes: [], programmes: [] });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [volunteers, setVolunteers] = useState([]);
  const [showVolunteers, setShowVolunteers] = useState(false);
  const [managers, setManagers] = useState([]);

  const handleUpdateBlockedFilters = async (nextFilters) => {
    try {
      const res = await fetch('/api/donors/block-filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockedFilters: nextFilters }),
      });
      const data = await res.json();
      if (data && data.ok) {
        setBlockedFilters(data.blockedFilters);

        // Log manager action
        const prefixesStr = nextFilters.admissionPrefixes?.length ? nextFilters.admissionPrefixes.join(', ') : 'None';
        const progsStr = nextFilters.programmes?.length ? nextFilters.programmes.join(', ') : 'None';
        await handleRecordManagerAction({
          request: 'Updated Block Filters',
          status: 'accepted',
          msg: `Manager ${managerSession?.name || 'Manager'} updated outreach block filters. Blocked Prefixes: [${prefixesStr}], Blocked Programmes: [${progsStr}].`
        });

        return true;
      }
    } catch (err) {
      console.error('Failed to save block filters:', err);
    }
    return false;
  };

  // Sort requests chronologically (oldest first) to assign sequential case numbers starting from 1
  const sortedChronologically = [...requests].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const requestsWithCaseNumbers = requests.map(r => {
    const caseIndex = sortedChronologically.findIndex(item => item.id === r.id);
    return {
      ...r,
      caseNumber: caseIndex !== -1 ? caseIndex + 1 : 1
    };
  });

  const [sheetMeta, setSheetMeta] = useState(null);
  const [whatsappAlertsEnabled, setWhatsAppAlertsEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;

    try {
      const stored = window.localStorage.getItem('manager-session');
      const parsed = stored ? JSON.parse(stored) : null;
      return parsed ? parsed.whatsapp_alerts_enabled !== false : true;
    } catch {
      return true;
    }
  });
  const [managerLogs, setManagerLogs] = useState([]);
  const [managerSession, setManagerSession] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = window.localStorage.getItem('manager-session');
      const parsed = stored ? JSON.parse(stored) : null;
      return parsed && parsed.id != null ? { ...parsed, whatsapp_alerts_enabled: parsed.whatsapp_alerts_enabled !== false } : null;
    } catch {
      return null;
    }
  });

  const [volunteerSession, setVolunteerSession] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = window.localStorage.getItem('volunteer-session');
      const parsed = stored ? JSON.parse(stored) : null;
      return parsed && parsed.id != null ? parsed : null;
    } catch {
      return null;
    }
  });

  const [activeOutreachDonor, setActiveOutreachDonor] = useState(null);
  const [activeOutreachRequest, setActiveOutreachRequest] = useState(null);
  const [activeDetailsRequest, setActiveDetailsRequest] = useState(null);
  const [whatsappStatus, setWhatsappStatus] = useState(null);
  const [whatsappEvents, setWhatsappEvents] = useState([]);

  const loadEvents = async () => {
    try {
      const res = await fetch('/api/admin/whatsapp/events');
      const data = await res.json();
      if (data && data.ok) {
        setWhatsappEvents(data.events || []);
      }
    } catch (err) {
      console.warn('Failed to load events:', err);
    }
  };

  const loadManagerLogs = async () => {
    try {
      const res = await fetch('/api/admin/manager-logs');
      const data = await res.json();
      if (data && data.ok) {
        const mappedLogs = (data.logs || []).map(item => ({
          id: item.id,
          donor: item.actor,
          request: item.request,
          msg: item.msg,
          status: item.status,
          time: formatISTDateTime(item.created_at) || 'just now',
        }));
        setManagerLogs(mappedLogs);
      }
    } catch (err) {
      console.warn('Failed to load manager logs:', err);
    }
  };

  const handleRefreshLogs = async () => {
    await loadEvents();
    await loadManagerLogs();
  };

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/admin/whatsapp/status');
        const data = await res.json();
        if (data && data.ok) {
          setWhatsappStatus(data);
        }
      } catch (err) {
        console.warn('Failed to load whatsapp config:', err);
      }
    };
    fetchConfig();
  }, []);

  const loadVolunteers = async () => {
    try {
      const list = await readVolunteerAccounts();
      setVolunteers(Array.isArray(list) ? list : []);
    } catch (err) {
      console.warn('Failed to load volunteers:', err);
    }
  };

  const loadManagersList = async () => {
    try {
      const list = await readManagerAccounts();
      setManagers(Array.isArray(list) ? list : []);
    } catch (err) {
      console.warn('Failed to load managers list:', err);
    }
  };

  useEffect(() => {
    if (view === 'logs' || view === 'manager' || view === 'dashboard') {
      loadEvents();
      loadManagerLogs();
      loadManagersList();
    }
    if (view === 'manager') {
      loadVolunteers();
    }
  }, [view]);

  const handleDeleteVolunteer = async (id, name, email) => {
    const actorName = managerSession?.name || 'Manager';
    const actorEmail = managerSession?.gmail || 'manager@fastforwardindia.org';

    await deleteVolunteerAccount(id, actorName, actorEmail);
    setVolunteers(current => current.filter(v => v.id !== id));
    await loadManagerLogs();
  };

  const [cooldowns, setCooldowns] = useState({});

  useEffect(() => {
    const activeIds = Object.keys(cooldowns).filter(id => cooldowns[id] > 0);
    if (activeIds.length === 0) return;

    const interval = setInterval(() => {
      setCooldowns(current => {
        const next = { ...current };
        let changed = false;
        for (const id of Object.keys(next)) {
          if (next[id] > 0) {
            next[id] -= 1;
            changed = true;
            if (next[id] === 0) {
              delete next[id];
            }
          }
        }
        return changed ? next : current;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldowns]);

  useEffect(() => {
    let active = true;

    const loadSheet = async () => {
      try {
        const store = await readPersistedSheet();
        if (!active) return;

        if (store) {
          if (Array.isArray(store.donors) && store.donors.length > 0) {
            setDonors(store.donors);
            setSheetMeta(store.sheetMeta || null);
          } else {
            setDonors(MOCK_DONORS);
            setSheetMeta(null);
          }
          if (store.blockedFilters) {
            setBlockedFilters(store.blockedFilters);
          }
        }
      } catch (error) {
        if (active) {
          console.warn('Falling back to local donor defaults:', error);
          setDonors(MOCK_DONORS);
          setSheetMeta(null);
        }
      }
    };

    loadSheet();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (managerSession) {
      window.localStorage.setItem('manager-session', JSON.stringify(managerSession));
    } else {
      window.localStorage.removeItem('manager-session');
    }
  }, [managerSession]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (volunteerSession) {
      window.localStorage.setItem('volunteer-session', JSON.stringify(volunteerSession));
    } else {
      window.localStorage.removeItem('volunteer-session');
    }
  }, [volunteerSession]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.location.hash) return;

    const cleanUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState({}, '', cleanUrl);
  }, []);

  const PAGE_TITLES = {
    dashboard: { title: 'Operator Dashboard', sub: 'Real-time overview of all donation activity' },
    request: { title: 'New Donation Request', sub: 'Submit or upload a blood requisition form' },
    recent: { title: 'Recent Requests', sub: 'Browse the latest request statuses and matches' },
    donors: { title: 'Donor Management', sub: 'Browse and notify eligible student donors' },
    logs: { title: 'Notification Logs', sub: 'WhatsApp outreach status and donor replies' },
    manager: { title: 'Manager Login', sub: 'Restricted access for the seeded manager account' },
    'add-manager': { title: 'Add Manager', sub: 'Create a new manager Gmail account' },
    'add-volunteer': { title: 'Add Volunteer', sub: 'Create a new volunteer account' },
  };

  const activePage = view === 'manager'
    ? (managerSession
      ? { title: 'Manager Dashboard', sub: 'Add manager Gmail accounts and review access' }
      : { title: 'Manager Login', sub: 'Restricted access for manager accounts' })
    : PAGE_TITLES[view];
  const { title, sub } = activePage;
  const navItems = NAV.map(item => item.key === 'donors' ? { ...item, badge: String(donors.length) } : item);

  const handleCreateRequest = request => {
    setRequests(currentRequests => [request, ...currentRequests]);
  };

  const handleManagerLoginSuccess = nextManagerSession => {
    const normalizedSession = { ...nextManagerSession, whatsapp_alerts_enabled: nextManagerSession.whatsapp_alerts_enabled !== false };
    setManagerSession(normalizedSession);
    setWhatsAppAlertsEnabled(normalizedSession.whatsapp_alerts_enabled);
    setView('manager');
  };

  const handleManagerSessionUpdate = nextManagerSession => {
    const normalizedSession = { ...nextManagerSession, whatsapp_alerts_enabled: nextManagerSession.whatsapp_alerts_enabled !== false };
    setManagerSession(normalizedSession);
    setWhatsAppAlertsEnabled(normalizedSession.whatsapp_alerts_enabled);
  };

  const handleToggleWhatsAppAlerts = enabled => {
    setWhatsAppAlertsEnabled(enabled);
  };

  const handleRecordManagerAction = async entry => {
    try {
      await fetch('/api/admin/manager-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actor: managerSession?.name || 'Manager',
          request: entry.request,
          msg: entry.msg,
          status: entry.status || 'accepted',
        }),
      });
      await loadManagerLogs();
    } catch (err) {
      console.warn('Failed to post manager action log:', err);
      const nextLog = {
        id: Date.now(),
        donor: managerSession?.name || 'Manager',
        request: entry.request,
        status: entry.status || 'accepted',
        time: 'just now',
        msg: entry.msg,
      };
      setManagerLogs(current => [nextLog, ...current]);
    }
  };

  const handleOpenAddManager = () => {
    if (!managerSession) return;
    setView('add-manager');
  };

  const handleOpenAddVolunteer = () => {
    if (!managerSession) return;
    setView('add-volunteer');
  };

  const handleBackToDashboard = () => {
    setView('manager');
  };

  const handleManagerLogout = () => {
    const confirmed = window.confirm('Are you sure you want to sign out of the Manager Dashboard?');
    if (confirmed) {
      setManagerSession(null);
    }
  };

  const handleVolunteerLoginSuccess = nextVolunteerSession => {
    setVolunteerSession(nextVolunteerSession);
  };

  const handleVolunteerLogout = () => {
    const confirmed = window.confirm('Are you sure you want to sign out? You will need to log in again.');
    if (confirmed) {
      setVolunteerSession(null);
      setManagerSession(null);
    }
  };

  const [showWhatsAppAdmin, setShowWhatsAppAdmin] = useState(() => {
    try {
      if (typeof window === 'undefined') return false;
      const params = new URLSearchParams(window.location.search);
      return params.get('view') === 'whatsapp-admin';
    } catch (e) { return false; }
  });
  const [showBlockCard, setShowBlockCard] = useState(false);
  const [whStatus, setWhStatus] = useState(null);
  const [whEvents, setWhEvents] = useState([]);
  useEffect(() => {
    const handlePopState = () => setView(current => current);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'whatsapp-admin') {
        // debug auto-open
        // console.log intentionally left for local debugging
        setShowWhatsAppAdmin(true);
      }
    } catch (e) { }
  }, []);

  if (typeof window !== 'undefined' && pathState.pathname === '/forgot-password') {
    return <ForgotPasswordPage />;
  }

  if (typeof window !== 'undefined' && pathState.pathname === '/volunteer-forgot-password') {
    return <VolunteerForgotPasswordPage />;
  }

  // Gate the entire dashboard behind volunteer login
  if (!volunteerSession) {
    return <VolunteerLoginView onLoginSuccess={handleVolunteerLoginSuccess} />;
  }

  return (
    <div className={`app ${mobileMenuOpen ? 'mobile-menu-active' : ''}`}>
      <div className="orb orb-1" />
      <div className="orb orb-2" />

      {/* ── Mobile Top Header ── */}
      <header className="mobile-header">
        <button type="button" className="mobile-menu-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} title="Toggle menu">
          ☰
        </button>
        <div className="mobile-header-title">
          <strong>Fast Forward India</strong>
        </div>
        <div className="mobile-header-avatar">
          👤
        </div>
      </header>

      {/* ── Mobile Sidebar Drawer Backdrop ── */}
      {mobileMenuOpen && (
        <div className="mobile-sidebar-backdrop" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <img className="logo-image" src="https://res.cloudinary.com/dvjschjlg/image/upload/v1722862190/FFI/Logo/gpq3l0srvnvyyjzeg8k5.png" alt="Fast Forward India logo" />
          <div className="logo-text">
            <strong>Fast Forward India</strong>
            <span>NGO · IIT (ISM) Dhanbad</span>
          </div>
        </div>

        <span className="sidebar-section-label">Navigation</span>

        {navItems.map(n => (
          <button key={n.key} className={`nav-item ${view === n.key ? 'active' : ''}`} onClick={() => { setView(n.key); setMobileMenuOpen(false); }}>
            <span className="nav-icon">{n.icon}</span>
            {n.label}
            {n.badge && <span className="nav-badge">{n.badge}</span>}
          </button>
        ))}

        <div className="sidebar-divider" />
        <span className="sidebar-section-label">System</span>

        <button className="nav-item" onClick={() => setMobileMenuOpen(false)}>
          <span className="nav-icon">⚙️</span> Settings
        </button>
        <button className={`nav-item ${view === 'manager' ? 'active' : ''}`} onClick={() => { setView('manager'); setMobileMenuOpen(false); }}>
          <span className="nav-icon">🔒</span> Manager Login
        </button>

        <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
          {managerSession && (
            <div className="sidebar-volunteer-info" style={{ marginBottom: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem' }}>
              <span className="volunteer-name">🔒 {managerSession.name || 'Manager'}</span>
              <span className="volunteer-email">{managerSession.gmail || ''}</span>
              <button type="button" className="volunteer-logout-btn" onClick={() => { handleManagerLogout(); setMobileMenuOpen(false); }}>
                ← Manager Sign Out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <h2>{title}</h2>
            <p>{sub}</p>
          </div>
          <div className="topbar-right">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-3)' }}>
              <div className="status-dot" /> Live
            </div>
            <button className="topbar-btn primary" onClick={() => setView('request')}>➕ New Request</button>
            <button className="topbar-btn" onClick={() => setView('donors')}>👥 Donors</button>
            <button className="topbar-btn" onClick={() => { console.log('WhatsApp Admin button clicked'); setShowWhatsAppAdmin(true); }}>📲 WhatsApp Admin</button>
            <button
              className="topbar-btn"
              onClick={handleVolunteerLogout}
              style={{
                background: 'var(--red-soft)',
                color: 'var(--red)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                fontWeight: 600,
              }}
              title="Sign out from the entire dashboard"
            >
              ← Logout
            </button>
          </div>
        </header>

        <div className={`content-area ${view === 'request' ? 'request-mode' : ''}`}>
          {view === 'dashboard' && <DashboardView donors={donors} requests={requestsWithCaseNumbers} onSeeAllNotifications={() => setView('logs')} onSeeAllRequests={() => setView('recent')} onOpenDetailsModal={setActiveDetailsRequest} whatsappEvents={whatsappEvents} volunteerSession={volunteerSession} managers={managers} />}
          {view === 'request' && <RequestView donors={donors} onCreateRequest={handleCreateRequest} />}
          {view === 'recent' && <RecentRequestsView requests={requestsWithCaseNumbers} onOpenDetailsModal={setActiveDetailsRequest} whatsappEvents={whatsappEvents} />}
          {view === 'donors' && <DonorsView donors={donors} setDonors={setDonors} sheetMeta={sheetMeta} setSheetMeta={setSheetMeta} whatsappAlertsEnabled={whatsappAlertsEnabled} onOpenOutreachModal={(donor) => { setActiveOutreachDonor(donor); setActiveOutreachRequest(null); }} cooldowns={cooldowns} setCooldowns={setCooldowns} onRecordAction={handleRecordManagerAction} whatsappEvents={whatsappEvents} managerSession={managerSession} volunteerSession={volunteerSession} blockedFilters={blockedFilters} setBlockedFilters={setBlockedFilters} />}
          {view === 'logs' && <LogsView managerLogs={managerLogs} whatsappEvents={whatsappEvents} onRefresh={handleRefreshLogs} requests={requestsWithCaseNumbers} onOpenDetailsModal={setActiveDetailsRequest} />}
          {view === 'manager' && (managerSession
            ? <ManagerDashboardView managerSession={managerSession} onLogout={handleManagerLogout} onAddManager={handleOpenAddManager} onAddVolunteer={handleOpenAddVolunteer} onUpdateSession={handleManagerSessionUpdate} onRecordAction={handleRecordManagerAction} onRefreshLogs={loadManagerLogs} onSeeAllActivity={() => setView('logs')} whatsappAlertsEnabled={whatsappAlertsEnabled} onToggleWhatsAppAlerts={handleToggleWhatsAppAlerts} donors={donors} volunteers={volunteers} whatsappEvents={whatsappEvents} onOpenWhatsAppAdmin={() => setShowWhatsAppAdmin(true)} onOpenBlockFilters={() => setShowBlockCard(true)} onOpenVolunteers={() => setShowVolunteers(true)} managers={managers} setManagers={setManagers} />
            : <ManagerLoginView managerSession={managerSession} onLoginSuccess={handleManagerLoginSuccess} />
          )}
          {view === 'add-manager' && managerSession && (
            <ManagerAddAccountView managerSession={managerSession} onLogout={handleManagerLogout} onBackToDashboard={handleBackToDashboard} onRecordAction={handleRecordManagerAction} />
          )}
          {view === 'add-volunteer' && managerSession && (
            <VolunteerAddAccountView managerSession={managerSession} onLogout={handleManagerLogout} onBackToDashboard={handleBackToDashboard} onRecordAction={handleRecordManagerAction} />
          )}
        </div>
        <WhatsAppAdminPanel open={showWhatsAppAdmin} onClose={() => setShowWhatsAppAdmin(false)} requests={requestsWithCaseNumbers} />
        <BlockFiltersModal
          open={showBlockCard}
          onClose={() => setShowBlockCard(false)}
          donors={donors}
          blockedFilters={blockedFilters}
          onUpdateBlockedFilters={handleUpdateBlockedFilters}
        />
        <VolunteersModal
          open={showVolunteers}
          onClose={() => setShowVolunteers(false)}
          volunteers={volunteers}
          managers={managers}
          onDeleteVolunteer={handleDeleteVolunteer}
          managerSession={managerSession}
        />
        <WhatsAppAlertModal
          open={activeOutreachDonor !== null}
          onClose={() => { setActiveOutreachDonor(null); setActiveOutreachRequest(null); }}
          donor={activeOutreachDonor}
          initialRequest={activeOutreachRequest}
          requests={requests}
          whatsappStatus={whatsappStatus}
          onSend={async (donor, message, tName, tLang, tParams, reqId) => {
            const sender = managerSession ? { name: managerSession.name, email: managerSession.gmail } : (volunteerSession ? { name: volunteerSession.name, email: volunteerSession.email } : null);
            const result = await sendDonorWhatsAppAlert(donor, message, tName, tLang, tParams, reqId, sender);
            setDonors(currentDonors => currentDonors.map(d => (d.id === donor.id ? { ...d, notified: true } : d)));
            setCooldowns(current => ({ ...current, [donor.id]: 20 }));
            await sendBrowserNotification('WhatsApp alert sent', `${donor.name || 'Donor'} has been notified.`);
            await loadEvents();
            alert(result.message || `WhatsApp alert sent successfully to ${donor.name || 'Donor'}!`);
            return result;
          }}
        />
        <RequestDetailsModal
          open={activeDetailsRequest !== null}
          onClose={() => setActiveDetailsRequest(null)}
          request={activeDetailsRequest}
          donors={donors}
          cooldowns={cooldowns}
          whatsappEvents={whatsappEvents}
          blockedFilters={blockedFilters}
          onOpenOutreachModal={(donor, request) => {
            setActiveOutreachDonor(donor);
            setActiveOutreachRequest(request);
          }}
        />
      </div>
    </div>
  );
}
