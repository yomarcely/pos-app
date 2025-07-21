<script setup lang="ts">
import {
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
</script>

<template>
    <DialogContent>
        <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>
                Make changes to your profile here. Click save when you're done.
            </DialogDescription>
        </DialogHeader>
        <DialogFooter>
            Save changes
        </DialogFooter>
    </DialogContent>
</template>