const ID = 'apex-archetype-alignment-items';
const GODS = ['khorne', 'nurgle', 'slaanesh', 'tzeentch'];
const LABEL = {khorne:'Khorne',nurgle:'Nurgle',slaanesh:'Slaanesh',tzeentch:'Tzeentch'};
const PREFIX = 'archetype-alignment-credit';

function getData(item) {
  const data = item.getFlag(ID, 'grant');
  if (!data || !GODS.includes(data.god)) return null;
  return {god:data.god, count: Math.max(1, Math.min(30, Math.floor(Number(data.count) || 5)))};
}
function isApexActor(item) {
  return item.parent?.documentName === 'Actor' && game.system.id === 'black-crusade-apex';
}
function hasPermission(actor) { return game.user.isGM && actor.isOwner; }
function keyFor(item, n) { return `${PREFIX}:${item.id}:${n}`; }
function creditsFor(item, data) {
  return Array.from({length:data.count}, (_, n) => ({
    type:'archetypeAlignment', key:keyFor(item,n),
    spec:`${item.name} — starting ${LABEL[data.god]} alignment (${n+1}/${data.count})`,
    cost:0, alignment:data.god, restore:{entries:[]}
  }));
}
async function synchronize(item, {remove=false}={}) {
  if (!isApexActor(item)) return;
  const actor = item.parent;
  if (!hasPermission(actor)) return;
  const data = getData(item);
  if (!data) return;
  const original = actor._source.system?.dh2e?.advanceLog ?? [];
  const tag = `${PREFIX}:${item.id}:`;
  const log = original.filter(row => !(typeof row?.key === 'string' && row.key.startsWith(tag)));
  if (!remove) log.push(...creditsFor(item,data));
  const changed = JSON.stringify(log) !== JSON.stringify(original);
  if (!changed && (remove || data.count < 5 || actor.system?.dh2e?.alignment === data.god)) return;
  const update = {'system.dh2e.advanceLog':log};
  if (!remove && data.count >= 5) update['system.dh2e.alignment'] = data.god;
  await actor.update(update);
  if (!remove) ui.notifications.info(`${item.name}: ${data.count} zero-XP ${LABEL[data.god]} credits applied to ${actor.name}.`);
}

const PACK_NAME = 'apex-archetype-alignment-credits';

function templates() {
  return GODS.flatMap(god => [1, 5].map(count => ({
    name: `Archetype Alignment — ${LABEL[god]} (+${count})`,
    type: 'ability',
    img: 'icons/magic/symbols/rune-sigil-rough-white-teal.webp',
    system: {
      description: `<p><strong>Archetype alignment credit:</strong> +${count} ${LABEL[god]}.</p><p>Zero-XP placeholder. Adds ${count} ${LABEL[god]} credit${count === 1 ? '' : 's'} to the Path of Chaos tracker when added to a character. Grants no talent, skill, characteristic, or XP. Remove the item to remove its credits.</p>`,
      category: 'archetype',
      dh2e: {kind:'',key:'',tier:1,cost:0}
    },
    flags: {[ID]:{grant:{god,count}}}
  })));
}

async function installCompendium() {
  if (!game.user.isGM) return {created:0, total:0};
  const id = `world.${PACK_NAME}`;
  let pack = game.packs.get(id);
  if (!pack) {
    pack = await foundry.documents.collections.CompendiumCollection.createCompendium({
      name: PACK_NAME,
      label: 'Apex BC — Archetype Alignment Credits',
      type: 'Item', package: 'world', system: game.system.id, private: false
    });
  }
  const index = await pack.getIndex({fields:['flags']});
  const existing = new Set();
  for (const entry of index) {
    const data = entry.flags?.[ID]?.grant;
    if (data && GODS.includes(data.god)) existing.add(`${data.god}:${data.count}`);
  }
  if (existing.size < 8 && index.length > 0) {
    const docs = await pack.getDocuments();
    for (const doc of docs) {
      const data = getData(doc);
      if (data) existing.add(`${data.god}:${data.count}`);
    }
  }
  const missing = templates().filter(t => !existing.has(`${t.flags[ID].grant.god}:${t.flags[ID].grant.count}`));
  if (missing.length) {
    if (pack.locked) await pack.configure({locked:false});
    await Item.createDocuments(missing, {pack:pack.collection});
  }
  return {created:missing.length, total:8, pack:pack.collection};
}

Hooks.once('ready', () => {
  if (game.system.id !== 'black-crusade-apex') return;
  Hooks.on('createItem', (item, _options, userId) => {
    if (userId !== game.user.id || !getData(item)) return;
    void synchronize(item).catch(err => { console.error(`${ID} create`,err); ui.notifications.error(`Alignment credit failed: ${err.message}`); });
  });
  Hooks.on('deleteItem', (item, _options, userId) => {
    if (userId !== game.user.id || !getData(item)) return;
    void synchronize(item, {remove:true}).catch(err => { console.error(`${ID} delete`,err); ui.notifications.error(`Alignment cleanup failed: ${err.message}`); });
  });
  Hooks.on('updateItem', (item, changed, _options, userId) => {
    if (userId !== game.user.id || !isApexActor(item)) return;
    if (!Object.prototype.hasOwnProperty.call(changed.flags?.[ID] ?? {}, 'grant')) return;
    void synchronize(item).catch(err => console.error(`${ID} update`,err));
  });
  game.modules.get(ID).api = {
    installCompendium,
    async createTemplates() {
      if (!game.user.isGM) throw new Error('GM permissions required');
      const existing = game.items.filter(item => getData(item));
      const toCreate = templates().filter(t => !existing.some(item => {
        const d=getData(item), g=t.flags[ID].grant;
        return d?.god === g.god && d?.count === g.count;
      }));
      if (toCreate.length) await Item.createDocuments(toCreate);
      return toCreate.length;
    },
    async repairActor(actor) {
      if (!hasPermission(actor)) throw new Error('GM ownership required.');
      for (const item of actor.items) if (getData(item)) await synchronize(item);
    },
    async setGrant(item, god, count=5) {
      if (!GODS.includes(god)) throw new Error('Unknown god');
      const n = Math.max(1,Math.min(30,Math.floor(Number(count) || 5)));
      if (!game.user.isGM) throw new Error('GM only');
      await item.setFlag(ID,'grant',{god,count:n});
      if (isApexActor(item)) await synchronize(item);
    }
  };
  void installCompendium()
    .then(({created}) => {if(created) ui.notifications.info(`Apex BC Alignment: ${created} compendium items added.`);})
    .catch(err => {console.error(`${ID}: automatic compendium setup failed`,err); ui.notifications.error(`Apex BC Alignment compendium setup failed: ${err.message}`);});
});
