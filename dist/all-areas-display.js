// ==========================================
// 2. LE GENERATEUR D'AFFICHAGE MULTI-ZONES (RÉPARÉ)
// ==========================================
class AllAreasDisplay extends HTMLElement {
  static getConfigElement() {
    return document.createElement("all-areas-display-editor");
  }

  static getStubConfig() {
    return {
      type: "custom:all-areas-display",
      layout_type: "grid",
      layout_options: { columns: 2 },
      template_card: {
        type: "button",
        name: "[[area_name]]",
        icon: "[[area_icon]]",
        entity: "[[default_entity]]"
      }
    };
  }

  constructor() {
    super();
    // On crée un conteneur racine pour isoler notre affichage
    this.innerHTML = `<div id="root"></div>`;
    this.content = this.querySelector('#root');
    this._childElements = [];
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;

    // Si les cartes enfants sont déjà créées, on met juste à jour leur objet HASS
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
    
    const config = this._config;
    const hass = this._hass;
    const template = config.template_card;

    if (!template || Object.keys(template).length === 0) {
      this.content.innerHTML = `<div style="padding:10px; color:var(--secondary-text-color);">Définissez une carte valide dans la configuration.</div>`;
      this._childElements = [];
      return;
    }

    const areas = Object.values(hass.areas || {});
    const helpers = await window.loadCardHelpers();
    
    // Nettoyage complet avant reconstruction
    this.content.innerHTML = '';
    this._childElements = [];

    // 1. On prépare le conteneur HTML selon le layout sélectionné
    const layoutType = config.layout_type || 'grid';
    const gridWrapper = document.createElement('div');

    if (layoutType === 'grid') {
      const cols = config.layout_options?.columns || 2;
      gridWrapper.style.display = 'grid';
      gridWrapper.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
      gridWrapper.style.gap = '8px';
    } else if (layoutType === 'horizontal-stack') {
      gridWrapper.style.display = 'flex';
      gridWrapper.style.flexDirection = 'row';
      gridWrapper.style.gap = '8px';
      gridWrapper.style.width = '100%';
    } else if (layoutType === 'vertical-stack') {
      gridWrapper.style.display = 'flex';
      gridWrapper.style.flexDirection = 'column';
      gridWrapper.style.gap = '8px';
    }

    // 2. Génération et injection de chaque carte pièce par pièce
    areas.forEach(area => {
      const areaId = area.area_id;

      // Recherche d'une entité actionable
      let defaultEntity = null;
      const matchCard = Object.values(hass.states).find(s => 
        (s.entity_id.startsWith('light.') || s.entity_id.startsWith('switch.') || s.entity_id.startsWith('input_boolean.')) && 
        hass.entities[s.entity_id]?.area_id === areaId
      );
      if (matchCard) defaultEntity = matchCard.entity_id;

      if (!defaultEntity) return; // On saute la pièce si elle n'a rien d'actionnable

      const areaName = area.name;
      const areaIcon = area.icon || "mdi:home-outline";
      const areaSlug = areaId.toLowerCase().replace(/ /g, '_');

      // Capteurs additionnels
      let areaTemp = "N/A";
      const tSensor = Object.values(hass.states).find(s => 
        s.entity_id.startsWith('sensor.') && s.attributes.device_class === 'temperature' && 
        hass.entities[s.entity_id]?.area_id === areaId
      );
      if (tSensor) areaTemp = tSensor.state + (tSensor.attributes.unit_of_measurement || '°C');

      let areaHumidity = "N/A";
      const hSensor = Object.values(hass.states).find(s => 
        s.entity_id.startsWith('sensor.') && s.attributes.device_class === 'humidity' && 
        hass.entities[s.entity_id]?.area_id === areaId
      );
      if (hSensor) areaHumidity = hSensor.state + (hSensor.attributes.unit_of_measurement || '%');

      // Remplacement des variables
      let raw = JSON.stringify(template);
      raw = raw.replaceAll('[[area_id]]', areaId)
               .replaceAll('[[area_name]]', areaName)
               .replaceAll('[[area_icon]]', areaIcon)
               .replaceAll('[[area_slug]]', areaSlug)
               .replaceAll('[[area_temp]]', areaTemp)
               .replaceAll('[[area_humidity]]', areaHumidity)
               .replaceAll('[[default_entity]]', defaultEntity);

      const cardConfig = JSON.parse(raw);

      try {
        // On crée la carte unitaire
        const cardElement = helpers.createCardElement(cardConfig);
        cardElement.hass = hass;
        
        // On l'ajoute à notre disposition et au suivi des mises à jour
        gridWrapper.appendChild(cardElement);
        this._childElements.push(cardElement);
      } catch (e) {
        console.error("Erreur création sous-carte:", e);
      }
    });

    // On injecte le tout d'un coup dans le DOM
    this.content.appendChild(gridWrapper);
  }

  setConfig(config) {
    this._config = config;
    this._buildCards(); // On force la reconstruction quand la config change à gauche
  }

  getCardSize() {
    return 3;
  }
}
customElements.define('all-areas-display', AllAreasDisplay);