class AllAreasDisplay extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        .grid-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 8px;
          width: 100%;
        }
      </style>
      <div class="grid-container" id="root"></div>
    `;
    this.content = this.shadowRoot.getElementById('root');
    this._childElements = [];
  }

  // Obligatoire pour Lovelace, définit la configuration de la carte
  setConfig(config) {
    this._config = config;
    this._buildCards();
  }

  // Appelé par HA dès que les données (états des entités, pièces) changent
  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;

    if (this._childElements.length > 0) {
      this._childElements.forEach(el => {
        if (el) el.hass = hass;
      });
    } else {
      this._buildCards();
    }
  }

  async _buildCards() {
    if (!this._hass || !this._config || !this.content) return;

    const hass = this._hass;
    const template = this._config.template_card || { type: "button", name: "[[area_name]]", icon: "[[area_icon]]", entity: "[[default_entity]]" };

    // Récupération des outils de génération de cartes de Home Assistant
    const helpers = window.loadCardHelpers ? await window.loadCardHelpers() : null;
    if (!helpers) return;

    const areas = Object.values(hass.areas || {});
    this.content.innerHTML = '';
    this._childElements = [];

    areas.forEach(area => {
      const areaId = area.area_id;
      const areaName = area.name;
      const areaIcon = area.icon || "mdi:home-outline";

      // Trouve une entité par défaut dans cette pièce pour la lier à la carte
      const match = Object.values(hass.states).find(s => hass.entities[s.entity_id]?.area_id === areaId);
      const defaultEntity = match ? match.entity_id : 'sun.sun';

      // Remplacement basique des variables
      let raw = JSON.stringify(template);
      raw = raw.replaceAll('[[area_id]]', areaId)
               .replaceAll('[[area_name]]', areaName)
               .replaceAll('[[area_icon]]', areaIcon)
               .replaceAll('[[default_entity]]', defaultEntity);

      const cardConfig = JSON.parse(raw);

      try {
        const cardElement = helpers.createCardElement(cardConfig);
        cardElement.hass = hass;
        this.content.appendChild(cardElement);
        this._childElements.push(cardElement);
      } catch (e) {
        console.error("Erreur lors de la création de la sous-carte :", e);
      }
    });
  }

  getCardSize() {
    return 3;
  }
}

customElements.define('all-areas-display', AllAreasDisplay);

// Enregistrement de la carte dans l'interface de Home Assistant
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'all-areas-display')) {
  window.customCards.push({
    type: "all-areas-display",
    name: "All Areas Display",
    preview: false,
    description: "Affiche une carte pour chaque pièce de la maison."
  });
}