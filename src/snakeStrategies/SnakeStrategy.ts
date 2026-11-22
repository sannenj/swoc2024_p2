import { Action } from "../action";

export interface SnakeStrategy {
    /**
     * Determine list of actions to take for snake.
     */
    update(): Action[];

    /**
     * Determine whether strategy is done.
     * If so, returns a human-readable reason for why,
     * otherwise returns `undefined` when not done.
     */
    isDone(): string | undefined;


    save() : Boolean;

    /**
     * Create human-readable representation of current state.
     */
    inspect(): string;
}
