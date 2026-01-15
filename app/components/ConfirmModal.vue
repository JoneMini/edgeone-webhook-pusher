<template>
  <UModal v-model:open="isOpen" :title="title">
    <template #body>
      <div class="flex items-start gap-4">
        <div
          v-if="icon"
          class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          :class="iconBgClass"
        >
          <UIcon :name="icon" class="text-xl" :class="iconClass" />
        </div>
        <div>
          <p class="text-gray-600 dark:text-gray-300">{{ message }}</p>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton variant="ghost" @click="handleCancel">
          {{ cancelText }}
        </UButton>
        <UButton :color="confirmColor" :loading="loading" @click="handleConfirm">
          {{ confirmText }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
interface Props {
  title?: string;
  message?: string;
  icon?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: '确认操作',
  message: '确定要执行此操作吗？',
  icon: 'i-heroicons-exclamation-triangle',
  confirmText: '确定',
  cancelText: '取消',
  danger: false,
  loading: false,
});

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const isOpen = defineModel<boolean>('open', { default: false });

const confirmColor = computed(() => props.danger ? 'error' : 'primary');

const iconBgClass = computed(() =>
  props.danger
    ? 'bg-red-100 dark:bg-red-900/30'
    : 'bg-yellow-100 dark:bg-yellow-900/30'
);

const iconClass = computed(() =>
  props.danger
    ? 'text-red-600 dark:text-red-400'
    : 'text-yellow-600 dark:text-yellow-400'
);

function handleConfirm() {
  emit('confirm');
}

function handleCancel() {
  isOpen.value = false;
  emit('cancel');
}
</script>
