import { supabase } from '../config/supabase.js';

export async function fetchAnnouncements() {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Gagal memuat pengumuman: ${error.message}`);
  return data || [];
}

export async function createAnnouncement({ title, content, isPinned = false, createdBy }) {
  const { data, error } = await supabase
    .from('announcements')
    .insert({
      title: String(title).trim(),
      content: String(content).trim(),
      is_pinned: Boolean(isPinned),
      created_by: createdBy
    })
    .select()
    .single();

  if (error) throw new Error(`Gagal menerbitkan pengumuman: ${error.message}`);
  return data;
}

export async function toggleAnnouncementPin(id, isPinned) {
  const { error } = await supabase
    .from('announcements')
    .update({ is_pinned: Boolean(isPinned) })
    .eq('id', id);

  if (error) throw new Error(`Gagal mengubah status sematan: ${error.message}`);
}

export async function deleteAnnouncement(id) {
  const { error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Gagal menghapus pengumuman: ${error.message}`);
}

export async function fetchMyNotifications(limit = 50) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Gagal memuat notifikasi: ${error.message}`);
  return data || [];
}

export async function markNotificationAsRead(notificationId) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) throw new Error(`Gagal memperbarui notifikasi: ${error.message}`);
}

export async function markAllNotificationsAsRead(userId) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw new Error(`Gagal menandai semua notifikasi: ${error.message}`);
}

export async function fetchActivityLogs(limit = 80) {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Gagal memuat activity log: ${error.message}`);
  return data || [];
}