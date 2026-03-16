// ===========================
// NexTask — Role Permissions
// ===========================

// Role hierarchy: owner > admin > manager > editor/designer/writer
const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MANAGER: 'manager',
  EDITOR: 'editor',
  DESIGNER: 'designer',
  WRITER: 'writer'
};

// Define which roles can access which features
const PERMISSIONS = {
  // Dashboard — everyone can see
  view_dashboard: ['owner', 'admin', 'manager', 'editor', 'designer', 'writer'],
  view_team_stats: ['owner', 'admin', 'manager'],

  // General Tasks
  create_tasks: ['owner', 'admin', 'manager'],
  assign_tasks: ['owner', 'admin', 'manager'],
  view_all_tasks: ['owner', 'admin', 'manager'],
  view_own_tasks: ['owner', 'admin', 'manager', 'editor', 'designer', 'writer'],
  edit_any_task: ['owner', 'admin', 'manager'],
  delete_tasks: ['owner', 'admin', 'manager'],

  // YT Automation (Channels & Videos)
  create_channels: ['owner', 'admin'],
  edit_channels: ['owner', 'admin'],
  delete_channels: ['owner', 'admin'],
  create_videos: ['owner', 'admin', 'manager'],
  edit_videos: ['owner', 'admin', 'manager'],
  delete_videos: ['owner', 'admin', 'manager'],

  // Freelance (Projects & Orders)
  create_projects: ['owner', 'admin'],
  edit_projects: ['owner', 'admin'],
  delete_projects: ['owner', 'admin'],
  create_orders: ['owner', 'admin', 'manager'],
  edit_orders: ['owner', 'admin', 'manager'],
  delete_orders: ['owner', 'admin', 'manager'],
  view_all_orders: ['owner', 'admin', 'manager'],
  view_own_orders: ['owner', 'admin', 'manager', 'editor', 'designer', 'writer'],

  // Team Management
  add_users: ['owner', 'admin'],
  remove_users: ['owner', 'admin'],
  manage_team: ['owner', 'admin'],
  manage_roles: ['owner', 'admin'],

  // Expenses
  view_expenses: ['owner', 'admin'],
  add_expenses: ['owner', 'admin'],
  delete_expenses: ['owner', 'admin'],

  // Settings
  view_settings: ['owner', 'admin'],

  // Notifications
  view_notifications: ['owner', 'admin', 'manager', 'editor', 'designer', 'writer'],

  // Delete anything
  delete_anything: ['owner', 'admin']
};

// Check if a role has a specific permission
export function hasPermission(userRole, permission) {
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.includes(userRole);
}

// Check if user can see a nav item
export function canAccessPage(userRole, pageName) {
  const pagePermissions = {
    dashboard: 'view_dashboard',
    yt_dashboard: 'view_dashboard',
    office_yt: 'view_dashboard',
    freelance_dashboard: 'view_dashboard',
    tasks: 'view_own_tasks',
    orders: 'view_own_orders',
    team: 'manage_team',
    expenses: 'view_expenses',
    settings: 'view_settings',
    notifications: 'view_notifications'
  };

  const requiredPermission = pagePermissions[pageName];
  if (!requiredPermission) return false;
  return hasPermission(userRole, requiredPermission);
}

// Get role display name
export function getRoleDisplayName(role) {
  const names = {
    owner: 'Owner',
    admin: 'Admin',
    manager: 'Manager',
    editor: 'Editor',
    designer: 'Designer',
    writer: 'Writer'
  };
  return names[role] || role;
}

// Get role badge color
export function getRoleBadgeClass(role) {
  const classes = {
    owner: 'badge-danger',
    admin: 'badge-primary',
    manager: 'badge-warning',
    editor: 'badge-info',
    designer: 'badge-success',
    writer: 'badge-neutral'
  };
  return classes[role] || 'badge-neutral';
}

export { ROLES, PERMISSIONS };
