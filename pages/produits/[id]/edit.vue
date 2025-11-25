<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <Button variant="ghost" size="icon" @click="goBack">
          <ArrowLeft class="w-5 h-5" />
        </Button>
        <div>
          <h1 class="text-3xl font-bold">Modifier le produit</h1>
          <p class="text-muted-foreground mt-1">
            Modifiez les informations de ce produit
          </p>
        </div>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" @click="goBack">
          <X class="w-4 h-4 mr-2" />
          Annuler
        </Button>
        <Button @click="saveProduct">
          <Save class="w-4 h-4 mr-2" />
          Enregistrer
        </Button>
      </div>
    </div>

    <!-- Onglets -->
    <Tabs
      :model-value="activeTab"
      @update:model-value="(value) => activeTab = value as string"
      class="w-full"
    >
      <TabsList class="!flex w-full h-auto">
        <TabsTrigger value="general">Général</TabsTrigger>
        <TabsTrigger value="variations">Variations</TabsTrigger>
        <TabsTrigger value="prix">Prix</TabsTrigger>
        <TabsTrigger value="stock">Stock</TabsTrigger>
        <TabsTrigger value="barcode">Code-barres</TabsTrigger>
      </TabsList>

      <!-- Onglet 1: Général -->
      <TabsContent value="general">
        <Card>
          <CardHeader>
            <CardTitle>Informations générales</CardTitle>
            <CardDescription>Informations de base du produit</CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
            <!-- Nom du produit -->
            <div class="space-y-2">
              <Label for="name">Nom du produit *</Label>
              <Input
                id="name"
                v-model="form.name"
                placeholder="Ex: T-shirt Bleu"
              />
            </div>

            <!-- Description -->
            <div class="space-y-2">
              <Label for="description">Description</Label>
              <Textarea
                id="description"
                v-model="form.description"
                placeholder="Décrivez votre produit..."
                rows="4"
              />
              <p class="text-xs text-muted-foreground">
                Description détaillée du produit (optionnel)
              </p>
            </div>

            <!-- Fournisseur -->
            <div class="space-y-2">
              <Label for="supplier">Fournisseur</Label>
              <div class="flex gap-2">
                <Select v-model="form.supplierId">
                  <SelectTrigger id="supplier" class="flex-1">
                    <SelectValue placeholder="Sélectionner un fournisseur" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id.toString()">
                      {{ supplier.name }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  type="button"
                  @click="openAddSupplierDialog"
                  title="Ajouter un fournisseur"
                >
                  <Plus class="w-4 h-4" />
                </Button>
              </div>
            </div>

            <!-- Marque -->
            <div class="space-y-2">
              <Label for="brand">Marque</Label>
              <div class="flex gap-2">
                <Select v-model="form.brandId">
                  <SelectTrigger id="brand" class="flex-1">
                    <SelectValue placeholder="Sélectionner une marque" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="brand in brands" :key="brand.id" :value="brand.id.toString()">
                      {{ brand.name }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  type="button"
                  @click="openAddBrandDialog"
                  title="Ajouter une marque"
                >
                  <Plus class="w-4 h-4" />
                </Button>
              </div>
            </div>

            <!-- Upload photo -->
            <div class="space-y-2">
              <Label>Photo du produit</Label>
              <div
                class="relative w-full aspect-square max-w-xs rounded-lg border-2 border-dashed transition-colors"
                :class="isDragging ? 'border-primary bg-primary/5' : 'border-muted bg-muted/50'"
                @dragover.prevent="isDragging = true"
                @dragleave.prevent="isDragging = false"
                @drop.prevent="handleDrop"
              >
                <!-- Image preview -->
                <img
                  v-if="form.image"
                  :src="form.image"
                  alt="Preview"
                  class="w-full h-full object-cover rounded-lg"
                />

                <!-- Upload zone -->
                <div
                  v-else
                  class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6"
                >
                  <ImageIcon class="w-12 h-12 text-muted-foreground" />
                  <div class="text-center">
                    <p class="text-sm text-muted-foreground mb-2">
                      Glissez-déposez une image ici
                    </p>
                    <p class="text-xs text-muted-foreground mb-3">ou</p>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      @click="triggerFileInput"
                    >
                      <Upload class="w-4 h-4 mr-2" />
                      Parcourir
                    </Button>
                  </div>
                </div>

                <!-- Delete button (overlay on image) -->
                <Button
                  v-if="form.image"
                  variant="destructive"
                  size="icon"
                  class="absolute top-2 right-2"
                  @click="removeImage"
                >
                  <Trash2 class="w-4 h-4" />
                </Button>

                <!-- Hidden file input -->
                <input
                  ref="fileInput"
                  type="file"
                  accept="image/*"
                  class="hidden"
                  @change="handleFileSelect"
                />
              </div>
              <p class="text-xs text-muted-foreground">
                Formats acceptés: JPG, PNG, WebP (max 5MB)
              </p>
            </div>

            <!-- Gestion du stock -->
            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <Label>Gérer le stock</Label>
                <p class="text-sm text-muted-foreground">
                  Activer le suivi des quantités en stock
                </p>
              </div>
              <Switch v-model="form.manageStock" />
            </div>

            <!-- Gestion des variations -->
            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <Label>Gérer les variations</Label>
                <p class="text-sm text-muted-foreground">
                  Activer les variations de produit (taille, couleur...)
                </p>
              </div>
              <Switch v-model="form.hasVariations" />
            </div>

            <!-- Catégories -->
            <div class="space-y-2">
              <Label>Catégorie</Label>
              <div class="border rounded-lg p-4 max-h-64 overflow-y-auto">
                <div v-if="categories.length === 0" class="text-center py-4 text-muted-foreground">
                  Aucune catégorie disponible
                </div>
                <div v-else class="space-y-2">
                  <CategoryTreeItem
                    v-for="category in categories"
                    :key="category.id"
                    :category="category"
                    :selected-id="form.categoryId"
                    @select="form.categoryId = $event"
                    @add-subcategory="openAddCategoryDialog"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- Onglet 2: Variations -->
      <TabsContent value="variations">
        <Card>
          <CardHeader>
            <CardTitle>Variations du produit</CardTitle>
            <CardDescription>Sélectionnez les variations disponibles pour ce produit</CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
            <div v-if="!form.hasVariations" class="text-center py-8 text-muted-foreground">
              <Info class="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Les variations sont désactivées pour ce produit.</p>
              <p class="text-sm">Activez-les dans l'onglet "Général" pour les configurer.</p>
            </div>

            <div v-else class="space-y-6">
              <div v-if="variationGroups.length === 0" class="text-center py-8 text-muted-foreground">
                <Layers class="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Aucun groupe de variation disponible.</p>
                <p class="text-sm">Créez d'abord des groupes de variations dans la page dédiée.</p>
              </div>

              <div v-else class="space-y-4">
                <!-- Menu déroulant pour sélectionner le groupe -->
                <div class="space-y-2">
                  <Label for="variation-group-select">Groupe de variation</Label>
                  <select
                    id="variation-group-select"
                    v-model="selectedGroupId"
                    class="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                  >
                    <option :value="null">Sélectionnez un groupe</option>
                    <option v-for="group in variationGroups" :key="group.id" :value="group.id">
                      {{ group.name }}
                    </option>
                  </select>
                </div>

                <!-- Afficher les variations du groupe sélectionné -->
                <div v-if="selectedGroup" class="space-y-3">
                  <Label class="font-semibold">Variations disponibles</Label>
                  <div class="border rounded-lg p-4 space-y-3 max-h-64 overflow-y-auto">
                    <div
                      v-for="variation in selectedGroup.variations"
                      :key="variation.id"
                      class="flex items-center space-x-2"
                    >
                      <Checkbox
                        :id="`variation-${variation.id}`"
                        v-model="variationCheckedState[variation.id]"
                      />
                      <Label
                        :for="`variation-${variation.id}`"
                        class="text-sm font-normal cursor-pointer"
                      >
                        {{ variation.name }}
                      </Label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- Onglet 3: Prix -->
      <TabsContent value="prix">
        <Card>
          <CardHeader>
            <CardTitle>Tarification</CardTitle>
            <CardDescription>Définissez le prix d'achat, le coefficient et la TVA</CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
            <!-- Prix d'achat HT -->
            <div class="space-y-2">
              <Label for="purchase-price">Prix d'achat HT</Label>
              <div class="relative">
                <Input
                  id="purchase-price"
                  v-model="form.purchasePrice"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  class="pr-8"
                  @input="handlePurchasePriceChange"
                />
                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
              </div>
            </div>

            <!-- Coefficient -->
            <div class="space-y-2">
              <Label for="coefficient">Coefficient multiplicateur</Label>
              <Input
                id="coefficient"
                v-model="coefficient"
                type="number"
                step="0.01"
                placeholder="2.00"
                @input="updatePriceFromPurchaseAndCoef"
              />
              <p class="text-xs text-muted-foreground">
                Prix de vente HT = Prix d'achat × Coefficient
              </p>
            </div>

            <!-- TVA -->
            <div class="space-y-2">
              <Label for="tva">Taux de TVA</Label>
              <select
                id="tva"
                v-model="form.tva"
                class="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="20">20% (Taux normal)</option>
                <option value="10">10% (Taux intermédiaire)</option>
                <option value="5.5">5,5% (Taux réduit)</option>
                <option value="2.1">2,1% (Taux super réduit)</option>
                <option value="0">0% (Exonéré)</option>
              </select>
            </div>

            <!-- Prix TTC modifiable -->
            <div class="space-y-2">
              <Label for="price-ttc">Prix de vente TTC</Label>
              <div class="relative">
                <Input
                  id="price-ttc"
                  v-model="form.priceTTC"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  class="pr-8"
                  @input="updateCoefFromPrices"
                />
                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
              </div>
              <p class="text-xs text-muted-foreground">
                Vous pouvez modifier manuellement le prix TTC
              </p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- Onglet 4: Stock -->
      <TabsContent value="stock">
        <Card>
          <CardHeader class="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Gestion du stock</CardTitle>
              <CardDescription>Ajustez le stock et consultez l'historique</CardDescription>
            </div>
            <Button variant="outline" @click="openStockHistory">
              <History class="w-4 h-4 mr-2" />
              Historique
            </Button>
          </CardHeader>
          <CardContent class="space-y-6">
            <div v-if="!form.hasVariations">
              <!-- Stock simple avec ajustement -->
              <div class="space-y-4">
                <!-- Affichage stock actuel et valeur -->
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <Label class="text-lg">Stock actuel</Label>
                    <p class="text-3xl font-bold mt-2">{{ form.stock || 0 }}</p>
                  </div>
                  <div>
                    <Label class="text-lg">Valeur stock</Label>
                    <p class="text-3xl font-bold mt-2">
                      {{ ((form.stock || 0) * (parseFloat(form.purchasePrice as string) || parseFloat(form.priceTTC as string) || 0)).toFixed(2) }} €
                    </p>
                  </div>
                </div>

                <!-- Type d'ajustement -->
                <div class="space-y-2">
                  <Label>Type d'ajustement</Label>
                  <select
                    v-model="stockAdjustmentType"
                    class="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="add">Ajouter au stock</option>
                    <option value="remove">Retirer du stock</option>
                    <option value="set">Définir le stock</option>
                  </select>
                </div>

                <!-- Quantité -->
                <div class="space-y-2">
                  <Label for="stock-adjustment">
                    {{ stockAdjustmentType === 'set' ? 'Nouveau stock' : 'Quantité' }}
                  </Label>
                  <Input
                    id="stock-adjustment"
                    v-model.number="stockAdjustmentQuantity"
                    type="number"
                    :min="stockAdjustmentType === 'remove' ? 1 : 0"
                    placeholder="0"
                  />
                </div>

                <!-- Stock minimum -->
                <div class="space-y-2">
                  <Label for="min-stock-edit">Stock minimum (alerte)</Label>
                  <Input
                    id="min-stock-edit"
                    v-model.number="form.minStock"
                    type="number"
                    min="0"
                    placeholder="5"
                  />
                  <p class="text-xs text-muted-foreground">
                    Vous serez alerté lorsque le stock descendra en dessous de ce seuil
                  </p>
                </div>

                <Button @click="applyStockAdjustment" class="w-full">
                  Appliquer l'ajustement
                </Button>
              </div>
            </div>

            <div v-else>
              <!-- Stock par variation avec ajustements -->
              <div v-if="selectedVariationsList.length === 0" class="text-center py-8 text-muted-foreground">
                <Info class="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Aucune variation sélectionnée.</p>
                <p class="text-sm">Sélectionnez des variations dans l'onglet "Variations".</p>
              </div>

              <div v-else class="space-y-6">
                <!-- Type d'ajustement global -->
                <div class="space-y-2">
                  <Label>Type d'ajustement</Label>
                  <select
                    v-model="stockAdjustmentType"
                    class="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="add">Ajouter au stock</option>
                    <option value="remove">Retirer du stock</option>
                    <option value="set">Définir le stock</option>
                  </select>
                </div>

                <!-- Grille des variations -->
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  <div
                    v-for="variation in selectedVariationsList"
                    :key="variation.id"
                    class="border rounded-lg p-4 space-y-3"
                  >
                    <div class="font-medium text-center">{{ variation.name }}</div>
                    <div class="text-center">
                      <Label class="text-xs text-muted-foreground">Stock actuel</Label>
                      <p class="text-2xl font-bold">
                        {{ form.stockByVariation?.[variation.id.toString()] || 0 }}
                      </p>
                    </div>
                    <div>
                      <Label class="text-xs">
                        {{ stockAdjustmentType === 'set' ? 'Nouveau stock' : 'Quantité' }}
                      </Label>
                      <Input
                        v-model.number="variationAdjustments[variation.id.toString()]"
                        type="number"
                        placeholder="0"
                        class="mt-1 text-center"
                      />
                    </div>
                    <div>
                      <Label class="text-xs">Stock minimum</Label>
                      <Input
                        v-model.number="form.minStockByVariation[variation.id]"
                        type="number"
                        min="0"
                        placeholder="5"
                        class="mt-1 text-center"
                      />
                    </div>
                  </div>
                </div>

                <Button @click="applyVariationStockAdjustments" class="w-full">
                  Appliquer les ajustements
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- Onglet 5: Code-barres -->
      <TabsContent value="barcode">
        <Card>
          <CardHeader>
            <CardTitle>Code-barres</CardTitle>
            <CardDescription>Définissez les codes-barres du produit</CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
            <!-- Code interne fournisseur -->
            <div class="space-y-2">
              <Label for="supplier-code">Code interne fournisseur</Label>
              <Input
                id="supplier-code"
                v-model="form.supplierCode"
                placeholder="Ex: REF-12345"
              />
              <p class="text-xs text-muted-foreground">
                Code ou référence interne du fournisseur (optionnel)
              </p>
            </div>

            <div v-if="!form.hasVariations">
              <!-- Code-barres simple -->
              <div class="space-y-2">
                <Label for="barcode">Code-barres du produit</Label>
                <Input
                  id="barcode"
                  v-model="form.barcode"
                  placeholder="Ex: 3401234567890"
                />
                <p class="text-xs text-muted-foreground">
                  Saisissez le code-barres du produit
                </p>
              </div>
            </div>

            <div v-else>
              <!-- Code-barres par variation -->
              <div v-if="selectedVariationsList.length === 0" class="text-center py-8 text-muted-foreground">
                <Info class="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Aucune variation sélectionnée.</p>
                <p class="text-sm">Sélectionnez des variations dans l'onglet "Variations".</p>
              </div>

              <div v-else class="space-y-4">
                <p class="text-sm text-muted-foreground">
                  Définissez un code-barres pour chaque combinaison de variations
                </p>
                <div v-for="variation in selectedVariationsList" :key="variation.id" class="space-y-2">
                  <Label :for="`barcode-${variation.id}`">{{ variation.name }}</Label>
                  <Input
                    :id="`barcode-${variation.id}`"
                    v-model="form.barcodeByVariation[variation.id]"
                    placeholder="Code-barres"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>

    <!-- Dialog pour ajouter une catégorie -->
    <Dialog v-model:open="showAddCategoryDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter une sous-catégorie</DialogTitle>
          <DialogDescription>
            Créez une nouvelle sous-catégorie
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="new-category-name">Nom de la catégorie *</Label>
            <Input
              id="new-category-name"
              v-model="newCategoryName"
              placeholder="Ex: Accessoires"
              @keyup.enter="saveNewCategory"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showAddCategoryDialog = false">
            Annuler
          </Button>
          <Button @click="saveNewCategory" :disabled="!newCategoryName.trim()">
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Dialog pour ajouter un fournisseur -->
    <Dialog v-model:open="showAddSupplierDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un fournisseur</DialogTitle>
          <DialogDescription>
            Créez un nouveau fournisseur
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="new-supplier-name">Nom du fournisseur *</Label>
            <Input
              id="new-supplier-name"
              v-model="newSupplierName"
              placeholder="Ex: Acme Corp"
              @keyup.enter="saveNewSupplier"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showAddSupplierDialog = false">
            Annuler
          </Button>
          <Button @click="saveNewSupplier" :disabled="!newSupplierName.trim()">
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Dialog pour ajouter une marque -->
    <Dialog v-model:open="showAddBrandDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter une marque</DialogTitle>
          <DialogDescription>
            Créez une nouvelle marque
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="new-brand-name">Nom de la marque *</Label>
            <Input
              id="new-brand-name"
              v-model="newBrandName"
              placeholder="Ex: Nike"
              @keyup.enter="saveNewBrand"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showAddBrandDialog = false">
            Annuler
          </Button>
          <Button @click="saveNewBrand" :disabled="!newBrandName.trim()">
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Dialog Historique des stocks -->
    <Dialog v-model:open="showStockHistoryDialog">
      <DialogContent class="max-w-6xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Historique des mouvements de stock</DialogTitle>
          <DialogDescription>
            Consultez tous les mouvements de stock pour ce produit
          </DialogDescription>
        </DialogHeader>

        <!-- Filtres et toggle vue -->
        <div class="flex flex-col md:flex-row gap-4 py-4">
          <!-- Toggle vue Chronologique / Catégorie -->
          <div class="flex gap-2">
            <Button
              :variant="historyViewMode === 'chronological' ? 'default' : 'outline'"
              @click="historyViewMode = 'chronological'"
            >
              Chronologique
            </Button>
            <Button
              :variant="historyViewMode === 'category' ? 'default' : 'outline'"
              @click="historyViewMode = 'category'"
            >
              Par catégorie
            </Button>
          </div>

          <!-- Filtre par variation (si produit avec variations) -->
          <div v-if="form.hasVariations && selectedVariationsList.length > 0" class="flex-1">
            <select
              v-model="selectedHistoryVariation"
              class="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="">Toutes les variations</option>
              <option
                v-for="variation in selectedVariationsList"
                :key="variation.id"
                :value="variation.id.toString()"
              >
                {{ variation.name }}
              </option>
            </select>
          </div>
        </div>

        <!-- Vue Chronologique -->
        <div v-if="historyViewMode === 'chronological'" class="max-h-[500px] overflow-y-auto">
          <div v-if="filteredStockHistory.length === 0" class="text-center py-8 text-muted-foreground">
            <Package class="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Aucun mouvement de stock{{ selectedHistoryVariation ? ' pour cette variation' : ' pour ce produit' }}</p>
          </div>

          <table v-else class="w-full">
            <thead class="bg-muted/50 sticky top-0">
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium">Date</th>
                <th class="px-4 py-2 text-left text-xs font-medium">Type</th>
                <th v-if="!selectedHistoryVariation" class="px-4 py-2 text-left text-xs font-medium">Variation</th>
                <th class="px-4 py-2 text-right text-xs font-medium">Quantité</th>
                <th class="px-4 py-2 text-right text-xs font-medium">Stock avant</th>
                <th class="px-4 py-2 text-right text-xs font-medium">Stock après</th>
                <th class="px-4 py-2 text-left text-xs font-medium">Référence</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="movement in filteredStockHistory" :key="movement.id" class="hover:bg-muted/30">
                <td class="px-4 py-2 text-sm">{{ formatDate(movement.createdAt) }}</td>
                <td class="px-4 py-2 text-sm">
                  <Badge :variant="getReasonVariant(movement.reason)">
                    {{ getReasonLabel(movement.reason) }}
                  </Badge>
                </td>
                <td v-if="!selectedHistoryVariation" class="px-4 py-2 text-sm">{{ getVariationName(movement.variation) }}</td>
                <td class="px-4 py-2 text-sm text-right font-medium" :class="movement.quantity > 0 ? 'text-green-600' : 'text-red-600'">
                  {{ movement.quantity > 0 ? '+' : '' }}{{ movement.quantity }}
                </td>
                <td class="px-4 py-2 text-sm text-right">{{ movement.previousStock ?? movement.oldStock ?? '-' }}</td>
                <td class="px-4 py-2 text-sm text-right font-medium">{{ movement.newStock }}</td>
                <td class="px-4 py-2 text-sm text-muted-foreground">
                  {{ getMovementReference(movement) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Vue par Catégorie -->
        <div v-else class="max-h-[500px] overflow-y-auto space-y-6">
          <div v-if="filteredStockHistory.length === 0" class="text-center py-8 text-muted-foreground">
            <Package class="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Aucun mouvement de stock{{ selectedHistoryVariation ? ' pour cette variation' : ' pour ce produit' }}</p>
          </div>

          <div v-else>
            <!-- Ventes -->
            <div v-if="movementsByCategory.sales.length > 0" class="space-y-3">
              <h3 class="font-semibold text-lg flex items-center gap-2">
                Ventes
                <Badge variant="secondary">{{ movementsByCategory.sales.length }}</Badge>
              </h3>
              <div class="border rounded-lg overflow-hidden">
                <table class="w-full">
                  <thead class="bg-muted/50">
                    <tr>
                      <th class="px-4 py-2 text-left text-xs font-medium">Date</th>
                      <th v-if="!selectedHistoryVariation" class="px-4 py-2 text-left text-xs font-medium">Variation</th>
                      <th class="px-4 py-2 text-right text-xs font-medium">Quantité</th>
                      <th class="px-4 py-2 text-left text-xs font-medium">Référence</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y">
                    <tr v-for="m in movementsByCategory.sales" :key="m.id">
                      <td class="px-4 py-2 text-sm">{{ formatDate(m.createdAt) }}</td>
                      <td v-if="!selectedHistoryVariation" class="px-4 py-2 text-sm">{{ getVariationName(m.variation) }}</td>
                      <td class="px-4 py-2 text-sm text-right text-red-600 font-medium">{{ m.quantity }}</td>
                      <td class="px-4 py-2 text-sm">{{ getMovementReference(m) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Réceptions fournisseurs -->
            <div v-if="movementsByCategory.receipts.length > 0" class="space-y-3">
              <h3 class="font-semibold text-lg flex items-center gap-2">
                Réceptions fournisseurs
                <Badge variant="secondary">{{ movementsByCategory.receipts.length }}</Badge>
              </h3>
              <div class="border rounded-lg overflow-hidden">
                <table class="w-full">
                  <thead class="bg-muted/50">
                    <tr>
                      <th class="px-4 py-2 text-left text-xs font-medium">Date</th>
                      <th v-if="!selectedHistoryVariation" class="px-4 py-2 text-left text-xs font-medium">Variation</th>
                      <th class="px-4 py-2 text-right text-xs font-medium">Quantité</th>
                      <th class="px-4 py-2 text-left text-xs font-medium">Référence</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y">
                    <tr v-for="m in movementsByCategory.receipts" :key="m.id">
                      <td class="px-4 py-2 text-sm">{{ formatDate(m.createdAt) }}</td>
                      <td v-if="!selectedHistoryVariation" class="px-4 py-2 text-sm">{{ getVariationName(m.variation) }}</td>
                      <td class="px-4 py-2 text-sm text-right text-green-600 font-medium">+{{ m.quantity }}</td>
                      <td class="px-4 py-2 text-sm">{{ getMovementReference(m) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Ajustements -->
            <div v-if="movementsByCategory.adjustments.length > 0" class="space-y-3">
              <h3 class="font-semibold text-lg flex items-center gap-2">
                Ajustements
                <Badge variant="secondary">{{ movementsByCategory.adjustments.length }}</Badge>
              </h3>
              <div class="border rounded-lg overflow-hidden">
                <table class="w-full">
                  <thead class="bg-muted/50">
                    <tr>
                      <th class="px-4 py-2 text-left text-xs font-medium">Date</th>
                      <th v-if="!selectedHistoryVariation" class="px-4 py-2 text-left text-xs font-medium">Variation</th>
                      <th class="px-4 py-2 text-right text-xs font-medium">Quantité</th>
                      <th class="px-4 py-2 text-right text-xs font-medium">Stock avant</th>
                      <th class="px-4 py-2 text-right text-xs font-medium">Stock après</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y">
                    <tr v-for="m in movementsByCategory.adjustments" :key="m.id">
                      <td class="px-4 py-2 text-sm">{{ formatDate(m.createdAt) }}</td>
                      <td v-if="!selectedHistoryVariation" class="px-4 py-2 text-sm">{{ getVariationName(m.variation) }}</td>
                      <td class="px-4 py-2 text-sm text-right font-medium" :class="m.quantity > 0 ? 'text-green-600' : 'text-red-600'">
                        {{ m.quantity > 0 ? '+' : '' }}{{ m.quantity }}
                      </td>
                      <td class="px-4 py-2 text-sm text-right">{{ m.previousStock ?? m.oldStock ?? '-' }}</td>
                      <td class="px-4 py-2 text-sm text-right font-medium">{{ m.newStock }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Entrées/Sorties -->
            <div v-if="movementsByCategory.entries.length > 0" class="space-y-3">
              <h3 class="font-semibold text-lg flex items-center gap-2">
                Entrées / Sorties
                <Badge variant="secondary">{{ movementsByCategory.entries.length }}</Badge>
              </h3>
              <div class="border rounded-lg overflow-hidden">
                <table class="w-full">
                  <thead class="bg-muted/50">
                    <tr>
                      <th class="px-4 py-2 text-left text-xs font-medium">Date</th>
                      <th v-if="!selectedHistoryVariation" class="px-4 py-2 text-left text-xs font-medium">Variation</th>
                      <th class="px-4 py-2 text-right text-xs font-medium">Quantité</th>
                      <th class="px-4 py-2 text-right text-xs font-medium">Stock avant</th>
                      <th class="px-4 py-2 text-right text-xs font-medium">Stock après</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y">
                    <tr v-for="m in movementsByCategory.entries" :key="m.id">
                      <td class="px-4 py-2 text-sm">{{ formatDate(m.createdAt) }}</td>
                      <td v-if="!selectedHistoryVariation" class="px-4 py-2 text-sm">{{ getVariationName(m.variation) }}</td>
                      <td class="px-4 py-2 text-sm text-right font-medium" :class="m.quantity > 0 ? 'text-green-600' : 'text-red-600'">
                        {{ m.quantity > 0 ? '+' : '' }}{{ m.quantity }}
                      </td>
                      <td class="px-4 py-2 text-sm text-right">{{ m.previousStock ?? m.oldStock ?? '-' }}</td>
                      <td class="px-4 py-2 text-sm text-right font-medium">{{ m.newStock }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Pertes -->
            <div v-if="movementsByCategory.losses.length > 0" class="space-y-3">
              <h3 class="font-semibold text-lg flex items-center gap-2">
                Pertes
                <Badge variant="secondary">{{ movementsByCategory.losses.length }}</Badge>
              </h3>
              <div class="border rounded-lg overflow-hidden">
                <table class="w-full">
                  <thead class="bg-muted/50">
                    <tr>
                      <th class="px-4 py-2 text-left text-xs font-medium">Date</th>
                      <th v-if="!selectedHistoryVariation" class="px-4 py-2 text-left text-xs font-medium">Variation</th>
                      <th class="px-4 py-2 text-right text-xs font-medium">Quantité</th>
                      <th class="px-4 py-2 text-right text-xs font-medium">Stock après</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y">
                    <tr v-for="m in movementsByCategory.losses" :key="m.id">
                      <td class="px-4 py-2 text-sm">{{ formatDate(m.createdAt) }}</td>
                      <td v-if="!selectedHistoryVariation" class="px-4 py-2 text-sm">{{ getVariationName(m.variation) }}</td>
                      <td class="px-4 py-2 text-sm text-right text-red-600 font-medium">{{ m.quantity }}</td>
                      <td class="px-4 py-2 text-sm text-right font-medium">{{ m.newStock }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})

import { X, Save, Upload, ImageIcon, Trash2, Info, Layers, Plus, ArrowLeft, History, Package } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const route = useRoute()
const productId = computed(() => route.params.id as string)
const activeTab = ref('general')
const isLoading = ref(true)

interface Variation {
  id: number
  name: string
  sortOrder: number
}

interface VariationGroup {
  id: number
  name: string
  variations: Variation[]
}

interface Category {
  id: number
  name: string
  children?: Category[]
}

interface Supplier {
  id: number
  name: string
  contact?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
}

interface Brand {
  id: number
  name: string
}

interface StockMovement {
  id: number
  productId: number
  variation?: string
  quantity: number
  previousStock?: number
  oldStock?: number
  newStock: number
  reason: string
  userId: number
  createdAt: string
  saleId?: number
  receiptNumber?: string
  movementId?: number
  movementNumber?: string
  movementComment?: string
}

// State
const categories = ref<Category[]>([])
const variationGroups = ref<VariationGroup[]>([])
const suppliers = ref<Supplier[]>([])
const brands = ref<Brand[]>([])
const coefficient = ref<string | number>('')
const selectedGroupId = ref<number | null>(null)
const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const showAddCategoryDialog = ref(false)
const newCategoryName = ref('')
const newCategoryParentId = ref<number | null>(null)
const showAddSupplierDialog = ref(false)
const newSupplierName = ref('')
const showAddBrandDialog = ref(false)
const newBrandName = ref('')
const showStockHistoryDialog = ref(false)
const historyViewMode = ref<'chronological' | 'category'>('chronological')
const stockHistory = ref<StockMovement[]>([])
const selectedHistoryVariation = ref<string>('')
const stockAdjustmentType = ref<'add' | 'remove' | 'set'>('add')
const stockAdjustmentQuantity = ref<number>(0)
const variationAdjustments = ref<Record<string, number>>({})

const form = ref({
  name: '',
  description: '',
  image: null as string | null,
  manageStock: true,
  hasVariations: false,
  categoryId: null as number | null,
  supplierId: null as string | null,
  brandId: null as string | null,
  selectedVariations: [] as number[],
  purchasePrice: '' as string | number,
  price: '' as string | number,
  priceTTC: '' as string | number,
  tva: '20',
  barcode: '',
  supplierCode: '',
  barcodeByVariation: {} as Record<number, string>,
  stock: 0,
  minStock: 5,
  stockByVariation: {} as Record<string, number>,
  minStockByVariation: {} as Record<number, number>,
})

// Computed
const selectedVariationsList = computed(() => {
  return variationGroups.value
    .flatMap(group => group.variations)
    .filter(v => form.value.selectedVariations.includes(v.id))
})

const selectedGroup = computed(() => {
  if (!selectedGroupId.value) return null
  return variationGroups.value.find(g => g.id === selectedGroupId.value) || null
})

// State pour gérer l'état des checkboxes individuellement
const variationCheckedState = reactive<Record<number, boolean>>({})

// Computed pour filtrer l'historique selon la variation sélectionnée
const filteredStockHistory = computed(() => {
  if (!selectedHistoryVariation.value) {
    return stockHistory.value
  }
  return stockHistory.value.filter(m => m.variation === selectedHistoryVariation.value)
})

// Computed pour grouper les mouvements par catégorie
const movementsByCategory = computed(() => {
  const categories = {
    sales: [] as StockMovement[],
    receipts: [] as StockMovement[],
    adjustments: [] as StockMovement[],
    entries: [] as StockMovement[],
    losses: [] as StockMovement[],
  }

  filteredStockHistory.value.forEach(movement => {
    switch (movement.reason) {
      case 'sale':
        categories.sales.push(movement)
        break
      case 'reception':
        categories.receipts.push(movement)
        break
      case 'inventory_adjustment':
        categories.adjustments.push(movement)
        break
      case 'entry':
      case 'exit':
        categories.entries.push(movement)
        break
      case 'loss':
        categories.losses.push(movement)
        break
    }
  })

  return categories
})

// Fonctions helper pour l'historique
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    sale: 'Vente',
    reception: 'Réception',
    inventory_adjustment: 'Ajustement',
    adjustment: 'Ajustement',
    entry: 'Entrée',
    exit: 'Sortie',
    loss: 'Perte',
  }
  return labels[reason] || reason
}

function getReasonVariant(reason: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    sale: 'destructive',
    reception: 'default',
    inventory_adjustment: 'secondary',
    adjustment: 'secondary',
    entry: 'default',
    exit: 'destructive',
    loss: 'destructive',
  }
  return variants[reason] || 'outline'
}

function getVariationName(variation?: string): string {
  if (!variation) return '-'

  for (const group of variationGroups.value) {
    const foundVariation = group.variations.find(v => v.id.toString() === variation)
    if (foundVariation) {
      return foundVariation.name
    }
  }
  return variation
}

function getMovementReference(movement: StockMovement): string {
  if (movement.saleId) {
    return `Vente #${movement.saleId}`
  }
  if (movement.movementNumber) {
    return movement.movementNumber
  }
  if (movement.receiptNumber) {
    return `Réception ${movement.receiptNumber}`
  }
  return `Mouvement #${movement.id}`
}

// Fonction pour ouvrir l'historique
async function openStockHistory() {
  showStockHistoryDialog.value = true
  selectedHistoryVariation.value = '' // Réinitialiser le filtre

  try {
    const response = await $fetch(`/api/products/${productId.value}/stock-history`) as any
    stockHistory.value = response.movements || []
  } catch (error) {
    console.error('Erreur lors du chargement de l\'historique:', error)
    toast.error('Erreur lors du chargement de l\'historique')
  }
}

// Fonction pour appliquer l'ajustement de stock simple
async function applyStockAdjustment() {
  if (!stockAdjustmentQuantity.value || stockAdjustmentQuantity.value === 0) {
    toast.error('Veuillez entrer une quantité')
    return
  }

  try {
    const response = await $fetch('/api/movements/create', {
      method: 'POST',
      body: {
        type: 'adjustment',
        comment: 'Ajustement depuis la fiche produit',
        userId: 1,
        items: [{
          productId: parseInt(productId.value),
          quantity: stockAdjustmentQuantity.value,
          adjustmentType: stockAdjustmentType.value,
        }],
      },
    }) as any

    toast.success(`Mouvement ${response.movement.movementNumber} créé avec succès`)

    // Recharger le produit pour obtenir le stock mis à jour
    await loadProduct()

    // Réinitialiser le formulaire
    stockAdjustmentQuantity.value = 0
  } catch (error: any) {
    console.error('Erreur lors de l\'ajustement du stock:', error)
    toast.error(error.data?.message || 'Erreur lors de l\'ajustement du stock')
  }
}

// Fonction pour appliquer les ajustements de stock par variation
async function applyVariationStockAdjustments() {
  const adjustmentsToApply = Object.entries(variationAdjustments.value).filter(
    ([, quantity]) => quantity && quantity !== 0
  )

  if (adjustmentsToApply.length === 0) {
    toast.error('Aucun ajustement à appliquer')
    return
  }

  try {
    // Créer un mouvement groupé avec tous les ajustements
    const items = adjustmentsToApply.map(([variationId, quantity]) => ({
      productId: parseInt(productId.value),
      variation: variationId,
      quantity: quantity,
      adjustmentType: stockAdjustmentType.value,
    }))

    const response = await $fetch('/api/movements/create', {
      method: 'POST',
      body: {
        type: 'adjustment',
        comment: 'Ajustement depuis la fiche produit',
        userId: 1,
        items,
      },
    }) as any

    toast.success(`Mouvement ${response.movement.movementNumber} créé avec succès`)

    // Recharger le produit pour obtenir le stock mis à jour
    await loadProduct()

    // Réinitialiser les ajustements
    variationAdjustments.value = {}
  } catch (error: any) {
    console.error('Erreur lors de l\'ajustement du stock:', error)
    toast.error(error.data?.message || 'Erreur lors de l\'ajustement du stock')
  }
}

// Fonction pour calculer le prix TTC depuis prix d'achat et coefficient
function updatePriceFromPurchaseAndCoef() {
  const purchasePrice = typeof form.value.purchasePrice === 'string'
    ? parseFloat(form.value.purchasePrice)
    : form.value.purchasePrice
  const coef = typeof coefficient.value === 'string'
    ? parseFloat(coefficient.value)
    : coefficient.value

  if (!purchasePrice || !coef || purchasePrice <= 0 || coef <= 0) {
    form.value.priceTTC = ''
    return
  }

  // Calculer le prix TTC : Prix d'achat × Coefficient
  const priceTTC = purchasePrice * coef
  form.value.priceTTC = priceTTC.toFixed(2)
}

// Fonction pour calculer le coefficient depuis prix d'achat et prix TTC
function updateCoefFromPrices() {
  const purchasePrice = typeof form.value.purchasePrice === 'string'
    ? parseFloat(form.value.purchasePrice)
    : form.value.purchasePrice
  const priceTTC = typeof form.value.priceTTC === 'string'
    ? parseFloat(form.value.priceTTC)
    : form.value.priceTTC

  if (!purchasePrice || !priceTTC || purchasePrice <= 0 || priceTTC <= 0) {
    return
  }

  // Calculer le coefficient : Prix TTC / Prix d'achat
  const coef = priceTTC / purchasePrice
  coefficient.value = coef.toFixed(2)
}

// Fonction appelée quand le prix d'achat change
function handlePurchasePriceChange() {
  // Si un coefficient existe, on calcule le prix TTC
  // Sinon, si un prix TTC existe, on calcule le coefficient
  const coef = typeof coefficient.value === 'string'
    ? parseFloat(coefficient.value)
    : coefficient.value
  const priceTTC = typeof form.value.priceTTC === 'string'
    ? parseFloat(form.value.priceTTC)
    : form.value.priceTTC

  if (coef && coef > 0) {
    // Si un coefficient existe, calculer le prix TTC
    updatePriceFromPurchaseAndCoef()
  } else if (priceTTC && priceTTC > 0) {
    // Si un prix TTC existe mais pas de coefficient, calculer le coefficient
    updateCoefFromPrices()
  }
}

// Fonctions pour l'upload d'image
function triggerFileInput() {
  fileInput.value?.click()
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    processImageFile(file)
  }
}

function removeImage() {
  form.value.image = null
  // Réinitialiser l'input file pour permettre de sélectionner à nouveau la même image
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

function handleDrop(event: DragEvent) {
  isDragging.value = false
  const file = event.dataTransfer?.files[0]
  if (file && file.type.startsWith('image/')) {
    processImageFile(file)
  } else {
    toast.error('Veuillez déposer un fichier image valide')
  }
}

function processImageFile(file: File) {
  // Vérifier la taille (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    toast.error('L\'image ne doit pas dépasser 5MB')
    return
  }

  // Lire le fichier et créer une URL data
  const reader = new FileReader()
  reader.onload = (e) => {
    form.value.image = e.target?.result as string
  }
  reader.onerror = () => {
    toast.error('Erreur lors de la lecture du fichier')
  }
  reader.readAsDataURL(file)
}

// Gestion des catégories
function openAddCategoryDialog(parentId: number) {
  newCategoryParentId.value = parentId
  newCategoryName.value = ''
  showAddCategoryDialog.value = true
}

async function saveNewCategory() {
  if (!newCategoryName.value.trim()) return

  try {
    await $fetch('/api/categories/create', {
      method: 'POST',
      body: {
        name: newCategoryName.value.trim(),
        parentId: newCategoryParentId.value,
      },
    })

    toast.success('Catégorie créée avec succès')
    showAddCategoryDialog.value = false
    newCategoryName.value = ''
    newCategoryParentId.value = null

    // Recharger les catégories
    await loadCategories()
  } catch (error: any) {
    console.error('Erreur lors de la création de la catégorie:', error)
    toast.error(error.data?.message || 'Erreur lors de la création de la catégorie')
  }
}

// Gestion des fournisseurs
function openAddSupplierDialog() {
  newSupplierName.value = ''
  showAddSupplierDialog.value = true
}

async function saveNewSupplier() {
  if (!newSupplierName.value.trim()) return

  try {
    const newSupplier = await $fetch<Supplier>('/api/suppliers/create', {
      method: 'POST',
      body: {
        name: newSupplierName.value.trim(),
      },
    })

    toast.success('Fournisseur créé avec succès')
    showAddSupplierDialog.value = false
    newSupplierName.value = ''

    // Recharger les fournisseurs
    await loadSuppliers()

    // Sélectionner automatiquement le nouveau fournisseur
    if (newSupplier) {
      form.value.supplierId = newSupplier.id.toString()
    }
  } catch (error: any) {
    console.error('Erreur lors de la création du fournisseur:', error)
    toast.error(error.data?.message || 'Erreur lors de la création du fournisseur')
  }
}

// Gestion des marques
function openAddBrandDialog() {
  newBrandName.value = ''
  showAddBrandDialog.value = true
}

async function saveNewBrand() {
  if (!newBrandName.value.trim()) return

  try {
    const newBrand = await $fetch<Brand>('/api/brands/create', {
      method: 'POST',
      body: {
        name: newBrandName.value.trim(),
      },
    })

    toast.success('Marque créée avec succès')
    showAddBrandDialog.value = false
    newBrandName.value = ''

    // Recharger les marques
    await loadBrands()

    // Sélectionner automatiquement la nouvelle marque
    if (newBrand) {
      form.value.brandId = newBrand.id.toString()
    }
  } catch (error: any) {
    console.error('Erreur lors de la création de la marque:', error)
    toast.error(error.data?.message || 'Erreur lors de la création de la marque')
  }
}

// Charger les données
async function loadCategories() {
  try {
    const response = await $fetch('/api/categories')
    categories.value = response.categories
  } catch (error) {
    console.error('Erreur lors du chargement des catégories:', error)
  }
}

async function loadVariationGroups() {
  try {
    const response = await $fetch('/api/variations')
    variationGroups.value = response.groups
    console.log('Variation groups loaded:', variationGroups.value)
  } catch (error) {
    console.error('Erreur lors du chargement des variations:', error)
  }
}

async function loadSuppliers() {
  try {
    suppliers.value = await $fetch('/api/suppliers')
  } catch (error) {
    console.error('Erreur lors du chargement des fournisseurs:', error)
  }
}

async function loadBrands() {
  try {
    brands.value = await $fetch('/api/brands')
  } catch (error) {
    console.error('Erreur lors du chargement des marques:', error)
  }
}

// Charger le produit existant
async function loadProduct() {
  try {
    isLoading.value = true
    const response = await $fetch(`/api/products/${productId.value}`) as any
    const product = response.product

    // Remplir le formulaire avec les données du produit
    form.value.name = product.name
    form.value.description = product.description || ''
    form.value.image = product.image
    form.value.barcode = product.barcode || ''
    form.value.supplierCode = product.supplierCode || ''
    form.value.categoryId = product.categoryId
    form.value.supplierId = product.supplierId ? product.supplierId.toString() : null
    form.value.brandId = product.brandId ? product.brandId.toString() : null
    form.value.purchasePrice = product.purchasePrice || ''
    form.value.priceTTC = product.price || ''
    form.value.tva = product.tva?.toString() || '20'
    form.value.hasVariations = !!(product.variationGroupIds && product.variationGroupIds.length > 0)
    form.value.selectedVariations = product.variationGroupIds || []
    form.value.barcodeByVariation = product.barcodeByVariation || {}
    form.value.stock = product.stock || 0
    form.value.minStock = product.minStock || 5
    // Forcer la réactivité en créant un nouvel objet
    form.value.stockByVariation = { ...(product.stockByVariation || {}) }
    form.value.minStockByVariation = { ...(product.minStockByVariation || {}) }

    // Calculer le coefficient si on a prix d'achat et prix TTC
    if (product.purchasePrice && product.price) {
      coefficient.value = (product.price / product.purchasePrice).toFixed(2)
    }
  } catch (error: any) {
    console.error('Erreur lors du chargement du produit:', error)
    toast.error('Erreur lors du chargement du produit')
    await navigateTo('/produits')
  } finally {
    isLoading.value = false
  }
}

// Sauvegarder le produit
// Fonction pour revenir à la page précédente
function goBack() {
  window.history.back()
}

async function saveProduct() {
  try {
    // Validation du formulaire
    if (!form.value.name.trim()) {
      toast.error('Le nom du produit est requis')
      activeTab.value = 'general'
      return
    }

    if (!form.value.priceTTC) {
      toast.error('Le prix de vente TTC est requis')
      activeTab.value = 'prix'
      return
    }

    // Préparer les données pour l'API
    // Gérer stockByVariation et minStockByVariation : conserver les stocks existants, ajouter les nouvelles variations à 0
    let updatedStockByVariation: Record<string, number> | null = null
    let updatedMinStockByVariation: Record<string, number> | null = null

    if (form.value.hasVariations && form.value.selectedVariations.length > 0) {
      updatedStockByVariation = {}
      updatedMinStockByVariation = {}
      form.value.selectedVariations.forEach(variationId => {
        const variationKey = variationId.toString()
        // Conserver le stock existant ou initialiser à 0
        updatedStockByVariation![variationKey] = form.value.stockByVariation[variationKey] ?? 0
        // Prendre le minStock de l'utilisateur
        updatedMinStockByVariation![variationKey] = form.value.minStockByVariation[variationId] || 5
      })
    }

    const productData = {
      name: form.value.name,
      description: form.value.description,
      image: form.value.image,
      barcode: form.value.barcode,
      barcodeByVariation: form.value.hasVariations ? form.value.barcodeByVariation : null,
      supplierCode: form.value.supplierCode,
      categoryId: form.value.categoryId,
      supplierId: form.value.supplierId,
      brandId: form.value.brandId,
      price: form.value.priceTTC, // Prix TTC
      purchasePrice: form.value.purchasePrice,
      tva: form.value.tva,
      manageStock: form.value.manageStock,
      minStock: form.value.hasVariations ? undefined : form.value.minStock, // Stock minimum pour produit simple
      // Note: stock n'est pas envoyé, il est conservé côté serveur
      hasVariations: form.value.hasVariations,
      variationGroupIds: form.value.hasVariations ? form.value.selectedVariations : null,
      stockByVariation: updatedStockByVariation,
      minStockByVariation: updatedMinStockByVariation,
    }

    // Appel API pour modifier le produit
    await $fetch(`/api/products/${productId.value}`, {
      method: 'PUT',
      body: productData,
    })

    toast.success('Produit modifié avec succès !')

    // Revenir à la page précédente au lieu de toujours aller sur /produits
    goBack()
  }
  catch (error: any) {
    console.error('Erreur lors de la sauvegarde du produit:', error)
    toast.error(error.data?.message || 'Erreur lors de la modification du produit')
  }
}

// Watchers pour déboguer
watch(() => form.value.hasVariations, (newVal) => {
  console.log('hasVariations changed to:', newVal)
})

watch(() => form.value.selectedVariations, (newVal) => {
  console.log('selectedVariations changed to:', newVal)
}, { deep: true })

// Synchroniser variationCheckedState avec form.selectedVariations
watch(() => form.value.selectedVariations, (newSelectedIds) => {
  variationGroups.value.forEach(group => {
    group.variations.forEach(variation => {
      variationCheckedState[variation.id] = newSelectedIds.includes(variation.id)
    })
  })
}, { deep: true })

// Synchroniser form.selectedVariations avec variationCheckedState
watch(variationCheckedState, (newState) => {
  const selectedIds: number[] = []
  Object.entries(newState).forEach(([id, checked]) => {
    if (checked) {
      selectedIds.push(Number(id))
    }
  })
  form.value.selectedVariations = selectedIds
}, { deep: true })

// Charger au montage
onMounted(async () => {
  await Promise.all([loadCategories(), loadVariationGroups(), loadSuppliers(), loadBrands()])

  // Charger le produit existant
  await loadProduct()

  // Initialiser variationCheckedState après le chargement
  variationGroups.value.forEach(group => {
    group.variations.forEach(variation => {
      variationCheckedState[variation.id] = form.value.selectedVariations.includes(variation.id)
    })
  })

  // Déduire automatiquement le groupe sélectionné si des variations sont déjà assignées
  if (form.value.selectedVariations.length > 0) {
    const firstVariationId = form.value.selectedVariations[0]
    const group = variationGroups.value.find(g =>
      g.variations.some(v => v.id === firstVariationId)
    )
    if (group) {
      selectedGroupId.value = group.id
    }
  }
})
</script>
