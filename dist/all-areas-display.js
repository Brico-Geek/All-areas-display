// ==========================================
// 1. L'ÉDITEUR VISUEL AVANCÉ (GUI OPTIMISÉ)
// ==========================================
class AllAreasDisplayEditor extends HTMLElement {
  async setConfig(config) {
    this._config = config;
    await this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._layoutFormElement) {
      this._layoutFormElement.hass = hass;
    }
    if (this._cardEditorElement) {
      this._cardEditorElement.hass = hass;
    }
  }

  async _render() {
    if (this._layoutFormElement) {
      this._updateFormValues();
      return;
    }

    // Design de l'interface avec des badges cliquables pour copier les variables
    this.innerHTML = `
      <div class="card-config" style="padding: 10px; display: flex; flex-direction: column; gap: 20px;">
        <h3 style="margin: 0; color: var(--primary-color);">1. Configuration de la Mise en Page</h3>
        <ha-form id="layout-form"></ha-form>
        
        <hr style="border: none; border-top: 1px solid var(--divider-color); margin: 5px 0;">
        
        <h3 style="margin: 0; color: var(--primary-color);">2. Configuration du Modèle de Carte</h3>
        <p style="margin: 0; font-size: 0.85em; color: var(--secondary-text-color);">
          Choisissez le type de carte de base puis configurez-la. Les variables ci-dessous remplaceront dynamiquement les données par pièce.
        </p>

        <!-- Sélecteur de type de carte pour changer d'interface facilement -->
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <label style="font-weight: bold; font-size: 0.9em;">Type de carte enfant :</label>
          <select id="card-type-selector" style="padding: 10px; border-radius: 4px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color);">
            <option value="tile">Tuile (Tile - Défaut)</option>
            <option value="button">Bouton (Button)</option>
            <option value="custom:mushroom-template-card">Mushroom Template</option>
            <option value="custom:mushroom-chips-card">Mushroom Chips</option>
            <option value="custom:button-card">Custom Button Card</option>
          </select>
        </div>

        <!-- Boîte d'aide interactive pour insérer les variables -->
        <div style="background: var(--secondary-background-color); padding: 12px; border-radius: 8px; border: 1px dashed var(--divider-color);">
          <strong style="font-size: 0.9em; display: block; margin-bottom: 8px;">💡 Astuce Variables :</strong>
          <p style="margin: 0 0 8px 0; font-size: 0.8em; color: var(--secondary-text-color);">
            L'éditeur officiel peut afficher une erreur rouge (ex: "Entité introuvable") quand vous tapez une variable. C'est normal ! La carte fonctionnera parfaitement une fois enregistrée.
          </p>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;" id="variable-badges">
            <span class="var-badge" data-var="[[area_name]]" style="cursor:pointer; background: var(--primary-color); color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.8em; font-family: monospace;">[[area_name]]</span>
            <span class="var-badge" data-var="[[area_icon]]" style="cursor:pointer; background: var(--primary-color); color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.8em; font-family: monospace;">[[area_icon]]</span>
            <span class="var-badge" data-var="[[default_entity]]" style="cursor:pointer; background: var(--primary-color); color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.8em; font-family: monospace;">[[default_entity]]</span>
            <span class="var-badge" data-var="[[area_temp]]" style="cursor:pointer; background: var(--primary-color); color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.8em; font-family: monospace;">[[area_temp]]</span>
            <span class="var-badge" data-var="[[area_humidity]]" style="cursor:pointer; background: var(--primary-color); color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.8em; font-family: monospace;">[[area_humidity]]</span>
            <span class="var-badge" data-var="[[area_slug]]" style="cursor:pointer; background: var(--primary-color); color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.8em; font-family: monospace;">[[area_slug]]</span>
          </div>
        </div>
        
        <div id="card-editor-container"></div>
      </div>
    `;

    this._layoutFormElement = this.querySelector("#layout-form");
    const editorContainer = this.querySelector("#card-editor-container");
    const typeSelector = this.querySelector("#card-type-selector");

    // Init du sélecteur de type de carte selon la config actuelle
    if (this._config.button_template?.type) {
      if (typeSelector.querySelector(`option[value="${this._config.button_template.type}"]`)) {
        typeSelector.value = this._config.button_template.type;
      }
    }

    // Changement de type de carte à la volée
    typeSelector.addEventListener("change", (ev) => {
      const targetType = ev.target.value;
      const currentTemplate = this._config.button_template || {};
      
      // On reconstruit une configuration propre pour la nouvelle carte pour éviter les crashs de structure
      let newTemplate = { type: targetType };
      if (targetType === "tile" || targetType === "button") {
        newTemplate.entity = "[[default_entity]]";
        newTemplate.name = "[[area_name]]";
        newTemplate.icon = "[[area_icon]]";
      } else if (targetType.includes("mushroom-template")) {
        newTemplate.primary = "[[area_name]]";
        newTemplate.secondary = "[[area_temp]]";
        newTemplate.icon = "[[area_icon]]";
      }

      this._fireConfigChanged({
        ...this._config,
        button_template: newTemplate
      });

      // On force le re-rendu complet du sous-éditeur pour appliquer le changement de type
      this._layoutFormElement = null;
      this._render();
    });

    // Rendre les badges cliquables pour faciliter le copier-coller rapide
    this.querySelectorAll(".var-badge").forEach(badge => {
      badge.addEventListener("click", (ev) => {
        const text = ev.target.getAttribute("data-var");
        navigator.clipboard.writeText(text);
        alert(`Copié dans le presse-papier : ${text}\nCollez-le dans le champ de votre choix.`);
      });
    });

    const layoutSchema = [
      {
        name: "layout_type",
        label: "Type d'affichage",
        selector: {
          select: {
            options: [
              { value: "grid", label: "Grille (Grid)" },
              { value: "horizontal-stack", label: "Pile Horizontale" },
              { value: "vertical-stack", label: "Pile Verticale" }
            ]
          }
        }
      },
      {
        name: "columns",
        label: "Nombre de colonnes (Mode Grille)",
        selector: {
          number: { min: 1, max: 12, mode: "box" }
        }
      }
    ];

    this._layoutFormElement.schema = layoutSchema;
    this._updateFormValues();

    this._layoutFormElement.addEventListener("value-changed", (ev) => {
      const value = ev.detail.value;
      this._fireConfigChanged({
        ...this._config,
        layout_type: value.layout_type || "grid",
        layout_options: { ...this._config.layout_options, columns: value.columns || 2 }
      });
    });

    // Injection de l'éditeur de carte Home Assistant
    try {
      const helpers = await window.loadCardHelpers();
      this._cardEditorElement = document.createElement("hui-card-element-editor");
      this._cardEditorElement.hass = this._hass;
      this._cardEditorElement.value = this._config.button_template || { type: "tile", name: "[[area_name]]" };

      this._cardEditorElement.addEventListener("config-changed", (ev) => {
        ev.stopPropagation();
        this._fireConfigChanged({
          ...this._config,
          button_template: ev.detail.config
        });
      });

      editorContainer.appendChild(this._cardEditorElement);
    } catch (err) {
      console.error("Erreur sélecteur HA:", err);
      editorContainer.innerHTML = `<p style="color:red;">Erreur de chargement de l'éditeur visuel.</p>`;
    }
  }

  _updateFormValues() {
    if (!this._layoutFormElement) return;
    this._layoutFormElement.data = {
      layout_type: this._config?.layout_type || "grid",
      columns: this._config?.layout_options?.columns || 2
    };
  }

  _fireConfigChanged(newConfig) {
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: newConfig },
      bubbles: true,
      composed: true,
    }));
  }
}
customElements.define('all-areas-display-editor', AllAreasDisplayEditor);