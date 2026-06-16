import type { CrmRepository } from "./crm-service";
import {
  demoCreateActivity,
  demoCreateLead,
  demoCreateMessage,
  demoFindLeadByWhatsapp,
  demoGetLeadById,
  demoListLeads,
  demoListMessages,
  demoListStores,
  demoListUsers,
  demoAuthenticateUser,
  demoPickSalespersonForStore,
  demoUpdateLead,
  shouldUseDemoStore
} from "./demo-store";
import {
  createActivity,
  createLead,
  createMessage,
  findLeadByWhatsapp,
  getLeadById,
  listLeads,
  listMessages,
  listStores,
  listUsers,
  authenticateUser,
  pickSalespersonForStore,
  updateLead
} from "./repositories";

const databaseRepository = {
  listStores,
  listUsers,
  authenticateUser,
  listLeads,
  getLeadById,
  findLeadByWhatsapp,
  pickSalespersonForStore,
  createLead,
  updateLead,
  createMessage,
  listMessages,
  createActivity
};

const demoRepository = {
  listStores: demoListStores,
  listUsers: demoListUsers,
  authenticateUser: demoAuthenticateUser,
  listLeads: demoListLeads,
  getLeadById: demoGetLeadById,
  findLeadByWhatsapp: demoFindLeadByWhatsapp,
  pickSalespersonForStore: demoPickSalespersonForStore,
  createLead: demoCreateLead,
  updateLead: demoUpdateLead,
  createMessage: demoCreateMessage,
  listMessages: demoListMessages,
  createActivity: demoCreateActivity
};

export function getRepository() {
  return shouldUseDemoStore() ? demoRepository : databaseRepository;
}

export function getCrmRepository(): CrmRepository {
  const repo = getRepository();
  return {
    findLeadByWhatsapp: repo.findLeadByWhatsapp,
    pickSalespersonForStore: repo.pickSalespersonForStore,
    createLead: repo.createLead,
    updateLead: repo.updateLead,
    createMessage: repo.createMessage,
    createActivity: repo.createActivity
  };
}
