import { z } from 'zod';

// Event category enum
export const EventCategorySchema = z.enum([
    'team-building',
    'workshop',
    'social',
    'conference',
    'celebration',
    'offsite',
    'other',
]);
export type EventCategory = z.infer<typeof EventCategorySchema>;

// Event status enum
export const EventStatusSchema = z.enum(['draft', 'upcoming', 'ongoing', 'completed', 'cancelled']);
export type EventStatus = z.infer<typeof EventStatusSchema>;

// RSVP status enum
export const RSVPStatusSchema = z.enum(['going', 'maybe', 'not-going', 'waitlist']);
export type RSVPStatus = z.infer<typeof RSVPStatusSchema>;

// Poll option schema
export const PollOptionSchema = z.object({
    id: z.string(),
    label: z.string(),
    votes: z.array(z.string()), // user IDs
});
export type PollOption = z.infer<typeof PollOptionSchema>;

// Poll schema
export const PollSchema = z.object({
    id: z.string(),
    question: z.string(),
    type: z.enum(['date', 'location', 'custom']),
    options: z.array(PollOptionSchema),
    isActive: z.boolean(),
    closesAt: z.string().optional(),
});
export type Poll = z.infer<typeof PollSchema>;

// Attendee schema
export const AttendeeSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    avatar: z.string().optional(),
    status: RSVPStatusSchema,
    respondedAt: z.string(),
});
export type Attendee = z.infer<typeof AttendeeSchema>;

// Vendor schema
export const VendorSchema = z.object({
    id: z.string(),
    name: z.string(),
    category: z.string(),
    contact: z.string(),
    cost: z.number(),
    status: z.enum(['pending', 'confirmed', 'paid']),
    notes: z.string().optional(),
});
export type Vendor = z.infer<typeof VendorSchema>;

// Budget item schema
export const BudgetItemSchema = z.object({
    id: z.string(),
    category: z.string(),
    description: z.string(),
    estimated: z.number(),
    actual: z.number().optional(),
});
export type BudgetItem = z.infer<typeof BudgetItemSchema>;

// Media item schema
export const MediaItemSchema = z.object({
    id: z.string(),
    url: z.string(),
    type: z.enum(['image', 'video']),
    uploadedBy: z.string(),
    uploadedAt: z.string(),
    caption: z.string().optional(),
});
export type MediaItem = z.infer<typeof MediaItemSchema>;

// Message channel and type enums
export const MessageChannelSchema = z.enum(['slack', 'email']);
export const MessageTypeSchema = z.enum(['announcement', 'reminder', 'poll', 'form']);
export const MessageStatusSchema = z.enum(['scheduled', 'sent', 'failed', 'cancelled']);

// Form field schema
export const FormFieldSchema = z.object({
    id: z.string(),
    type: z.enum(['text', 'textarea', 'select', 'checkbox', 'rating']),
    label: z.string(),
    required: z.boolean(),
    options: z.array(z.string()).optional(),
});
export type FormField = z.infer<typeof FormFieldSchema>;

// Scheduled message schema
export const ScheduledMessageSchema = z.object({
    id: z.string(),
    eventId: z.string(),
    type: MessageTypeSchema,
    subject: z.string(),
    content: z.string(),
    channels: z.array(MessageChannelSchema),
    recipientType: z.enum(['all', 'going', 'maybe', 'custom']),
    customRecipients: z.array(z.string()).optional(),
    scheduledFor: z.string(),
    timezone: z.string(),
    pollOptions: z.array(z.string()).optional(),
    formFields: z.array(FormFieldSchema).optional(),
    status: MessageStatusSchema,
    sentAt: z.string().optional(),
    errorMessage: z.string().optional(),
    createdBy: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
});
export type ScheduledMessage = z.infer<typeof ScheduledMessageSchema>;

// Budget object schema
export const BudgetSchema = z.object({
    total: z.number(),
    items: z.array(BudgetItemSchema),
});
export type Budget = z.infer<typeof BudgetSchema>;

// Full event schema
export const EventSchema = z.object({
    id: z.string(),
    title: z.string().min(1),
    description: z.string(),
    category: EventCategorySchema,
    status: EventStatusSchema,
    startDate: z.string(),
    endDate: z.string().optional(),
    location: z.string(),
    isVirtual: z.boolean(),
    virtualLink: z.string().optional(),
    capacity: z.number().min(1),
    waitlistEnabled: z.boolean(),
    attendees: z.array(AttendeeSchema),
    polls: z.array(PollSchema),
    hasVotingEnabled: z.boolean(),
    budget: BudgetSchema,
    vendors: z.array(VendorSchema),
    media: z.array(MediaItemSchema),
    coverImage: z.string().optional(),
    scheduledMessages: z.array(ScheduledMessageSchema),
    slackChannel: z.string().optional(),
    calendarEventId: z.string().optional(),
    createdBy: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
});
export type Event = z.infer<typeof EventSchema>;

// User schema
export const UserSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    avatar: z.string().optional(),
    role: z.enum(['admin', 'organizer', 'member']),
});
export type User = z.infer<typeof UserSchema>;

// Request schemas for API endpoints
export const CreateEventRequestSchema = EventSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    attendees: true,
    media: true,
    scheduledMessages: true,
});
export type CreateEventRequest = z.infer<typeof CreateEventRequestSchema>;

export const UpdateEventRequestSchema = EventSchema.partial().omit({
    id: true,
    createdAt: true,
    createdBy: true,
});
export type UpdateEventRequest = z.infer<typeof UpdateEventRequestSchema>;

export const RSVPRequestSchema = z.object({
    status: RSVPStatusSchema,
    userId: z.string(),
    userName: z.string(),
    userEmail: z.string().email(),
    userAvatar: z.string().optional(),
});
export type RSVPRequest = z.infer<typeof RSVPRequestSchema>;

export const CreatePollRequestSchema = PollSchema.omit({ id: true });
export type CreatePollRequest = z.infer<typeof CreatePollRequestSchema>;

export const VoteRequestSchema = z.object({
    optionId: z.string(),
    userId: z.string(),
});
export type VoteRequest = z.infer<typeof VoteRequestSchema>;

export const CreateBudgetItemRequestSchema = BudgetItemSchema.omit({ id: true });
export type CreateBudgetItemRequest = z.infer<typeof CreateBudgetItemRequestSchema>;

export const CreateVendorRequestSchema = VendorSchema.omit({ id: true });
export type CreateVendorRequest = z.infer<typeof CreateVendorRequestSchema>;

export const CreateMediaRequestSchema = z.object({
    type: z.enum(['image', 'video']),
    uploadedBy: z.string(),
    caption: z.string().optional(),
    fileName: z.string(),
    contentType: z.string(),
});
export type CreateMediaRequest = z.infer<typeof CreateMediaRequestSchema>;

export const CreateScheduledMessageRequestSchema = ScheduledMessageSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
export type CreateScheduledMessageRequest = z.infer<typeof CreateScheduledMessageRequestSchema>;
