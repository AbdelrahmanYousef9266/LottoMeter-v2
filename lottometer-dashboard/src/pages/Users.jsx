import { useState, useCallback } from 'react'
import { listUsers, createUser, updateUser, deleteUser } from '../api/users'
import useApi from '../hooks/useApi'
import Badge from '../components/UI/Badge'
import Table from '../components/UI/Table'
import Modal from '../components/UI/Modal'
import Button from '../components/UI/Button'
import { formatDate } from '../utils/dateTime'
import { useAuth } from '../context/AuthContext'

function UserForm({ form, setForm, formError, editTarget }) {
  return (
    <>
      <div className="form-group">
        <label className="form-label">
          Username <span style={{ color: 'var(--red)' }}>*</span>
        </label>
        <input
          className="input-field"
          placeholder="Enter username"
          value={form.username}
          onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
          autoComplete="off"
        />
      </div>
      <div className="form-group">
        <label className="form-label">
          Password {!editTarget && <span style={{ color: 'var(--red)' }}>*</span>}
          {editTarget && <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}> (leave blank to keep current)</span>}
        </label>
        <input
          className="input-field"
          type="password"
          placeholder={editTarget ? 'New password (optional)' : 'Enter password'}
          value={form.password}
          onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
          autoComplete="new-password"
        />
      </div>
      <div className="form-group">
        <label className="form-label">Role</label>
        <select
          className="input-field"
          value={form.role}
          onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
        >
          <option value="employee">Employee</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      {formError && <p style={{ color: 'var(--red)', fontSize: 13 }}>{formError}</p>}
    </>
  )
}

export default function Users() {
  const { user: currentUser } = useAuth()
  const isAdmin = currentUser?.role === 'admin'

  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const [form, setForm] = useState({ username: '', password: '', role: 'employee' })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const apiFn = useCallback(() => listUsers(), [])
  const { data, loading, error, refetch } = useApi(apiFn)
  const users = Array.isArray(data) ? data : data?.users || data?.data || []

  const openAdd = () => {
    setForm({ username: '', password: '', role: 'employee' })
    setFormError('')
    setAddOpen(true)
  }

  const openEdit = (u) => {
    setEditTarget(u)
    setForm({ username: u.username, password: '', role: u.role || 'employee' })
    setFormError('')
  }

  const handleSave = async () => {
    if (!form.username.trim()) {
      setFormError('Username is required.')
      return
    }
    if (!editTarget && !form.password) {
      setFormError('Password is required for new users.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      if (editTarget) {
        const payload = { username: form.username, role: form.role }
        if (form.password) payload.password = form.password
        await updateUser(editTarget.user_id, payload)
        setEditTarget(null)
      } else {
        await createUser(form)
        setAddOpen(false)
      }
      setForm({ username: '', password: '', role: 'employee' })
      refetch()
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Failed to save user.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteUser(deleteTarget.user_id)
      setDeleteTarget(null)
      refetch()
    } catch (err) {
      console.log('DELETE USER ERROR:', err?.response?.status, err?.response?.data)
      setDeleteError(err?.response?.data?.message || 'Failed to delete user.')
    } finally {
      setDeleting(false)
    }
  }

  const columns = [
    {
      key: 'username',
      label: 'Username',
      render: (v) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      key: 'role',
      label: 'Role',
      render: (v) => (
        <Badge variant={v === 'admin' ? 'blue' : 'gray'}>
          {v || 'employee'}
        </Badge>
      ),
    },
    {
      key: 'store_code',
      label: 'Store',
      render: (v, row) => v || row.store?.store_name || '—',
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (v) => formatDate(v),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: 8 }}>
          {isAdmin && (
            <>
              <button
                className="btn btn-secondary btn-sm"
                onClick={(e) => { e.stopPropagation(); openEdit(row) }}
              >
                Edit
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); setDeleteError('') }}
                disabled={row.user_id === currentUser?.user_id}
              >
                Delete
              </button>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p className="page-header-sub">Manage store users and their permissions</p>
        </div>
        {isAdmin && (
          <Button onClick={openAdd}>+ Add User</Button>
        )}
      </div>

      {error && (
        <div style={{ color: 'var(--red)', marginBottom: 16, fontSize: 14 }}>Error: {error}</div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <Table
          columns={columns}
          data={users}
          loading={loading}
          emptyMessage="No users found."
        />
      </div>

      {/* Add User Modal */}
      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); setFormError('') }}
        title="Add New User"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>Create User</Button>
          </>
        }
      >
        <UserForm form={form} setForm={setForm} formError={formError} editTarget={editTarget} />
      </Modal>

      {/* Edit User Modal */}
      <Modal
        open={!!editTarget}
        onClose={() => { setEditTarget(null); setFormError('') }}
        title="Edit User"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>Save Changes</Button>
          </>
        }
      >
        <UserForm form={form} setForm={setForm} formError={formError} editTarget={editTarget} />
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => { setDeleteTarget(null); setDeleteError('') }}
        title="Delete User"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>Delete</Button>
          </>
        }
      >
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Are you sure you want to delete user <strong>{deleteTarget?.username}</strong>?
          This action cannot be undone and will remove all associated data.
        </p>
        {deleteError && (
          <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 12 }}>{deleteError}</p>
        )}
      </Modal>
    </div>
  )
}
