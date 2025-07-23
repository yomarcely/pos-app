// stores/seller.ts
import { defineStore } from 'pinia';

export const useSellerStore = defineStore('seller', {
  state: () => ({
    seller: null as { id: number; name: string } | null
  }),
  getters: {
    isLoggedIn: state => state.seller != null,
    sellerName: state => state.seller ? state.seller.name : ''
  },
  actions: {
    login(sellerData: { id: number; name: string }) {
      this.seller = sellerData;
    },
    logout() {
      this.seller = null;
    }
  }
});
