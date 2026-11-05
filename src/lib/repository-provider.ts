import { withTransaction } from "./db";
import type { CrmRepository } from "./crm-service";
import {
  demoCreateAppointment,
  demoCreateActivity,
  demoCreateLead,
  demoCreateMessage,
  demoFindLeadByWhatsapp,
  demoFindMessageByExternalId,
  demoGetLeadById,
  demoListAppointments,
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
  createAppointment,
  createActivity,
  createLead,
  createMessage,
  findLeadByWhatsapp,
  getLeadById,
  getMessageByExternalId,
  listAppointments,
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
  createActivity,
  createAppointment,
  listAppointments
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
  createActivity: demoCreateActivity,
  createAppointment: demoCreateAppointment,
  listAppointments: demoListAppointments
};

export function getRepository() {
  return shouldUseDemoStore() ? demoRepository : databaseRepository;
}

export function getCrmRepository(): CrmRepository {
  if (shouldUseDemoStore()) {
    return {
      findLeadByWhatsapp: demoFindLeadByWhatsapp,
      pickSalespersonForStore: demoPickSalespersonForStore,
      createLead: demoCreateLead,
      updateLead: demoUpdateLead,
      createMessage: demoCreateMessage,
      createActivity: demoCreateActivity,
      findMessageByExternalId: demoFindMessageByExternalId
    };
  }

  return {
    findLeadByWhatsapp,
    pickSalespersonForStore,
    createLead,
    updateLead,
    createMessage,
    createActivity,
    findMessageByExternalId: getMessageByExternalId,
    withTransaction(fn) {
      return withTransaction((client) =>
        fn({
          findLeadByWhatsapp: (storeId, whatsappNumber) => findLeadByWhatsapp(storeId, whatsappNumber, client),
          pickSalespersonForStore: (storeId) => pickSalespersonForStore(storeId, client),
          createLead: (input) => createLead(input, client),
          updateLead: (id, input) => updateLead(id, input, client),
          createMessage: (input) => createMessage(input, client),
          createActivity: (input) => createActivity(input, client),
          findMessageByExternalId: (externalMessageId) => getMessageByExternalId(externalMessageId, client)
        })
      );
    }
  };
}
