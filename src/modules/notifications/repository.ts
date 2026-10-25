// src/modules/notifications/repository.ts
import { db } from '@/lib/db'

export const notificationsRepository = {
  create: (data: { userId: string; channel: string; eventType: string; status: string; message?: string }) =>
    db.notification.create({ data: { userId: data.userId, channel: data.channel, eventType: data.eventType, status: data.status, message: data.message ?? null } }),

  findByUser: (userId: string, take = 50, unreadOnly = false) =>
    db.notification.findMany({ where: unreadOnly ? { userId, isRead: false } : { userId }, orderBy: { createdAt: 'desc' }, take }),

  unreadCount: (userId: string) =>
    db.notification.count({ where: { userId, isRead: false } }),

  markRead: (userId: string, id: string) =>
    db.notification.updateMany({ where: { id, userId }, data: { isRead: true } }),

  markAllRead: (userId: string) =>
    db.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } }),
}
