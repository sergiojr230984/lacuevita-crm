import type { CrmRepository } from "./crm-service";
import {
  demoCreateAppointment,
  demoCreateActivity,
  demoCreateLead,
  demoCreateMessage,
  demoFindLeadByWhatsapp,
  demoGetLeadById,
  demoListAppointments,
  demoListDestinationNumbers,
  demoListLeads,
  demoListMessages,
  demoListStores,
  demoListUsers,
  demoAuthenticateUser,
  demoPickSalespersonForStore,
  demoRouteDestinationNumber,
  demoUpdateLead,
  demoUpsertDestinationNumber,
  shouldUseDemoStore
} from "./demo-store";
import {
  createAppointment,
  createActivity,
  createLead,
  createMessage,
  findLeadByWhatsapp,
  getLeadById,
  listAppointments,
  listDestinationNumbers,
  listLeads,
  listMessages,
  listStores,
  listUsers,
  authenticateUser,
  pickSalespersonForStore,
  routeDestinationNumber,
  updateLead,
  upsertDestinationNumber
} from "./repositories";

const databaseRepository = {
  listStores,
  listUsers,
  authenticateUser,
  listLeads,
  getLeadById,
  findLeadByWhatsapp,
  pickSalespersonForStore,
  routeDestinationNumber,
  listDestinationNumbers,
  upsertDestinationNumber,
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
  routeDestinationNumber: demoRouteDestinationNumber,
  listDestinationNumbers: demoListDestinationNumbers,
  upsertDestinationNumber: demoUpsertDestinationNumber,
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
  const repo = getRepository();
  return {
    findLeadByWhatsapp: repo.findLeadByWhatsapp,
    pickSalespersonForStore: repo.pickSalespersonForStore,
    routeDestinationNumber: repo.routeDestinationNumber,
    createLead: repo.createLead,
    updateLead: repo.updateLead,
    createMessage: repo.createMessage,
    createActivity: repo.createActivity
  };
}
