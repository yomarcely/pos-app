<script setup lang="ts">
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
</script>
<template>
  <form :class="cn('flex flex-col gap-6')">
    <div class="flex flex-col items-center gap-2 text-center">
      <h1 class="text-2xl font-bold">
        Login to your account
      </h1>
      <p class="text-balance text-sm text-muted-foreground">
        Enter your email below to login to your account
      </p>
    </div>
    <div class="grid gap-6">
      <div class="grid gap-2">
        <Label for="email">Email</Label>
        <Input id="email" type="email" placeholder="m@example.com" required />
      </div>
      <div class="grid gap-2">
        <div class="flex items-center">
          <Label for="password">Password</Label>
          <a
            href="#"
            class="ml-auto text-sm underline-offset-4 hover:underline"
          >
            Forgot your password?
          </a>
        </div>
        <Input id="password" type="password" required />
      </div>
      <Button type="submit" class="w-full">
        Login
      </Button>
      <div class="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
        <span class="relative z-10 bg-background px-2 text-muted-foreground">
          Or continue with
        </span>
      </div>
      <Button variant="outline" class="w-full">
        Login with GitHub
      </Button>
    </div>
    <div class="text-center text-sm">
      Don't have an account?
      <a href="#" class="underline underline-offset-4">
        Sign up
      </a>
    </div>
  </form>
</template>