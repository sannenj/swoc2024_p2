import { GameState } from "../GameState";
import { Snake } from "../Snake";
import { Action, ActionType } from "../action";
import { allSteps, nextSteps, sameAddress, toFlat } from "../address";
import { Address } from "../common";
import { pickRandom } from "../util";
import { SnakeStrategy } from "./SnakeStrategy";

export class TargetSnakeStrategy implements SnakeStrategy {
    constructor(
        public gameState: GameState,
        public snake: Snake,
        public target: Address
    ) {}

    isDone(): string | undefined {
        return this.isTargetReached() ? "target reached" : undefined;
    }

    isTargetReached(): boolean {
        return sameAddress(this.target, this.snake.head);
    }

    determineNextStep(): Address | undefined {
        const possibleNextSteps = nextSteps(this.snake.head, this.target);
        let availableSteps =
            this.gameState.grid.filterAvailable(possibleNextSteps);
        if (availableSteps.length === 0) {
            const allPossibleSteps = allSteps(this.snake.head, this.target);
            availableSteps =
                this.gameState.grid.filterAvailable(allPossibleSteps);
        }
        return pickRandom(availableSteps);
    }

    update(): Action[] {
        const step = this.determineNextStep();
        if (step) {
            this.gameState.grid.getCell(step).markAsOurs()
            return [
                {
                    type: ActionType.Move,
                    snakeName: this.snake.name,
                    nextLocation: step,
                },
            ];
        }
        return [];
    }

    inspect(): string {
        return `[${this.constructor.name} target=${toFlat(this.target)} targetPlayer=${this.gameState.getCell(this.target).player}]`;
    }

    save() : Boolean {
        return false;
    }
}
