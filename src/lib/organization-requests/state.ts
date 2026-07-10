export type OrganizationRequestActionState = {
  success: boolean;
  message: string;
  requestId?: string;
};

export const initialOrganizationRequestState: OrganizationRequestActionState = {
  success: false,
  message: "",
};
