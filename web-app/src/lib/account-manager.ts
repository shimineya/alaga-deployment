export interface SavedAccount {
  user: {
    id?: number;
    user_id: number;
    username: string;
    email: string;
    name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    role: string;
    account_status?: string;
    facility_id?: number | null;
    facility_name?: string | null;
    profile_picture_url?: string | null;
    profilePictureUrl?: string | null;
  };
  token: string;
}

const STORAGE_KEY = 'alaga_saved_accounts';

export const AccountManager = {
  getSavedAccounts(): SavedAccount[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    let accounts: SavedAccount[] = [];
    if (raw) {
      try {
        accounts = JSON.parse(raw);
        if (!Array.isArray(accounts)) accounts = [];
      } catch {
        accounts = [];
      }
    }

    // Always ensure current active user is included
    const currentToken = localStorage.getItem('token');
    const currentUserRaw = localStorage.getItem('user');
    if (currentToken && currentUserRaw) {
      try {
        const currentUser = JSON.parse(currentUserRaw);
        const currentUserId = currentUser.id || currentUser.user_id;
        const index = accounts.findIndex(
          a => (a.user.id || a.user.user_id) === currentUserId
        );
        if (index >= 0) {
          accounts[index] = { user: currentUser, token: currentToken };
        } else {
          accounts.unshift({ user: currentUser, token: currentToken });
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
      } catch {}
    }

    return accounts;
  },

  addSavedAccount(account: SavedAccount): void {
    const accounts = this.getSavedAccounts();
    const newUserId = account.user.id || account.user.user_id;
    const existingIndex = accounts.findIndex(
      a => (a.user.id || a.user.user_id) === newUserId
    );

    if (existingIndex >= 0) {
      accounts[existingIndex] = account;
    } else {
      accounts.push(account);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  },

  removeSavedAccount(userId: number): SavedAccount[] {
    let accounts = this.getSavedAccounts();
    accounts = accounts.filter(a => (a.user.id || a.user.user_id) !== userId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
    return accounts;
  },

  switchAccount(userId: number): boolean {
    const accounts = this.getSavedAccounts();
    const target = accounts.find(a => (a.user.id || a.user.user_id) === userId);
    if (!target) return false;

    // Switch active credentials
    localStorage.setItem('token', target.token);
    localStorage.setItem('user', JSON.stringify(target.user));

    // Reload window so the entire app layout, role navigation, and permissions re-initialize
    window.location.reload();
    return true;
  }
};
