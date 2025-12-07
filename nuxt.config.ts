// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },
  modules: [
    '@nuxt/image',
    '@nuxt/icon',
    '@nuxt/fonts',
    '@nuxtjs/color-mode',
    'shadcn-nuxt',
    '@pinia/nuxt'
  ],
  colorMode: {
  classSuffix: '', // ✅ produit <html class="dark">
  preference: 'light',
  fallback: 'light'
},
  css: ['~/assets/css/tailwind.css'],
  runtimeConfig: {
    // Variables serveur uniquement (privées)
    supabase: {
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      jwtSecret: process.env.SUPABASE_JWT_SECRET,
    },
    database: {
      url: process.env.DATABASE_URL,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      name: process.env.DB_NAME,
      ssl: process.env.DB_SSL === 'true',
    },
    nf525: {
      infocertPrivateKey: process.env.INFOCERT_PRIVATE_KEY,
      infocertMerchantId: process.env.INFOCERT_MERCHANT_ID,
    },
    security: {
      jwtSecret: process.env.JWT_SECRET,
    },
    archiving: {
      path: process.env.ARCHIVE_PATH,
      schedule: process.env.ARCHIVE_SCHEDULE,
    },
    rgpd: {
      dpoEmail: process.env.DPO_EMAIL,
      customerDataRetention: process.env.CUSTOMER_DATA_RETENTION,
    },
    // Variables publiques (accessibles côté client)
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      defaultTenantId: process.env.DEFAULT_TENANT_ID,
      baseUrl: process.env.BASE_URL || 'http://localhost:3000',
      nodeEnv: process.env.NODE_ENV || 'development',
    },
  },
  vite: {
    plugins: [
      tailwindcss(),
    ],
  },
  nitro: {
    externals: {
      inline: ['@supabase/supabase-js'],
    },
    // ==========================================
    // HEADERS DE SÉCURITÉ (NF525 + RGPD)
    // ==========================================
    routeRules: {
      '/**': {
        headers: {
          // Content Security Policy - Prévient XSS et injection de contenu
          'Content-Security-Policy': [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Note: 'unsafe-eval' requis pour Vue/Nuxt en dev
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com data:",
            "img-src 'self' data: https: blob:",
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join('; '),

          // X-Frame-Options - Prévient le clickjacking
          'X-Frame-Options': 'DENY',

          // X-Content-Type-Options - Prévient le MIME sniffing
          'X-Content-Type-Options': 'nosniff',

          // X-XSS-Protection - Protection XSS des navigateurs anciens
          'X-XSS-Protection': '1; mode=block',

          // Referrer-Policy - Contrôle les informations de référence
          'Referrer-Policy': 'strict-origin-when-cross-origin',

          // Permissions-Policy - Désactive les APIs dangereuses
          'Permissions-Policy': [
            'camera=()',
            'microphone=()',
            'geolocation=()',
            'interest-cohort=()', // Désactive FLoC de Google
          ].join(', '),

          // Strict-Transport-Security - Force HTTPS (uniquement en production)
          ...(process.env.NODE_ENV === 'production' ? {
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
          } : {}),
        },
      },
    },
  },
  shadcn: {
    /**
     * Prefix for all the imported component
     */
    prefix: '',
    /**
     * Directory that the component lives in.
     * @default "./components/ui"
     */
    componentDir: './components/ui'
  },
})
