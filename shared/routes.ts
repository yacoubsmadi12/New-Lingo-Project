import { z } from 'zod';
import { insertUserSchema, insertTermSchema, insertQuizSchema, users, terms, quizzes, badges, userBadges } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    register: {
      method: 'POST' as const,
      path: '/api/register',
      input: insertUserSchema,
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    login: {
      method: 'POST' as const,
      path: '/api/login',
      input: z.object({
        username: z.string(),
        password: z.string(),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/logout',
      responses: {
        200: z.void(),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/user',
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  terms: {
    list: {
      method: 'GET' as const,
      path: '/api/terms',
      input: z.object({
        department: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof terms.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/terms',
      input: insertTermSchema,
      responses: {
        201: z.custom<typeof terms.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  quizzes: {
    create: {
      method: 'POST' as const,
      path: '/api/quizzes',
      input: insertQuizSchema,
      responses: {
        201: z.custom<typeof quizzes.$inferSelect>(),
      },
    },
    history: {
      method: 'GET' as const,
      path: '/api/quizzes/history',
      responses: {
        200: z.array(z.custom<typeof quizzes.$inferSelect>()),
      },
    },
  },
  leaderboard: {
    list: {
      method: 'GET' as const,
      path: '/api/leaderboard',
      responses: {
        200: z.array(z.object({
          username: z.string(),
          points: z.number(),
          streak: z.number(),
          department: z.string(),
        })),
      },
    },
  },
  badges: {
    list: {
      method: 'GET' as const,
      path: '/api/badges',
      responses: {
        200: z.array(z.custom<typeof badges.$inferSelect>()),
      },
    },
    userBadges: {
      method: 'GET' as const,
      path: '/api/user-badges',
      responses: {
        200: z.array(z.custom<typeof userBadges.$inferSelect>()),
      },
    },
  },
  ai: {
    duel: {
      method: 'POST' as const,
      path: '/api/ai/duel',
      input: z.object({
        topic: z.string().optional(),
        difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
      }),
      responses: {
        200: z.object({
          question: z.string(),
          options: z.array(z.string()),
          correctAnswer: z.string(),
        }),
      },
    },
    admin: {
      ldapSettings: {
        path: "/api/admin/ldap-settings",
        method: "GET",
      },
      updateLdapSettings: {
        path: "/api/admin/ldap-settings",
        method: "POST",
      },
      users: {
        path: "/api/admin/users",
        method: "GET",
      },
      ldapSync: {
        path: "/api/admin/ldap-sync",
        method: "POST",
      },
      awardBadge: {
        path: "/api/admin/award-badge",
        method: "POST",
      },
    },
    rewards: {
      list: {
        path: "/api/rewards",
        method: "GET",
      },
    },
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
