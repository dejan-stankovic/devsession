import {IState} from "./index";
import {IUser, IUserWithLocalData} from "@devsession/common";

export const getMe = (state: IState): IUserWithLocalData => {
  const me = state.users.users.find(u => !!u.isItMe);

  if (!me) {
    console.log('Users in store are: ', state.users.users);
    throw Error('Attempted to find user profile, but user profile was not in Redux State Store.');
  } else {
    return me;
  }
};
