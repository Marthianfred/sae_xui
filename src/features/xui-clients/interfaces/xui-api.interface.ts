export enum XuiAction {
  CREATE_LINE = 'create_line',
  EDIT_LINE = 'edit_line',
  ENABLE_LINE = 'enable_line',
  DISABLE_LINE = 'disable_line',
  DELETE_LINE = 'delete_line',
  GET_PACKAGES = 'get_packages',
  GET_BOUQUETS = 'get_bouquets',
}

export interface XuiApiResponse<T = any> {
  result: boolean;
  message?: string;
  data?: T;
  error?: string;
  id?: number;
}

export interface XuiClientData {
  username: string;
  password?: string;
  bouquets_selected: number[];
  notes?: string;
  reseller_notes?: string;
  max_connections?: number;
  mac?: string;
  email?: string;
  phone?: string;
}
