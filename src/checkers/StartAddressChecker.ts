import { GameState } from "../GameState";
import { Action } from "../action";
import { sameAddress } from "../address";
import { ActionChecker } from "../strategy";

export class StartAddressChecker implements ActionChecker {
    check(gameState: GameState, action: Action): string | undefined {
        const allowSaving = gameState.snakes.length > 1 || gameState.foodManager.foods.size <= 1;
        return !allowSaving &&
            sameAddress(gameState.startAddress, action.nextLocation)
            ? "saving prevented"
            : undefined;
    }
}
