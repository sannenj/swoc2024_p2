import "dotenv/config";
import "source-map-support/register";

import * as grpc from "@grpc/grpc-js";
import { writeFile } from "fs/promises";
import { GameState } from "./GameState";
import { RpcClient } from "./RpcClient";
import { ActionType } from "./action";
import { ExistingCellsCollisionChecker } from "./checkers/ExistingCellsCollisionChecker";
import { NextActionCollisionActionsChecker } from "./checkers/NextActionCollisionActionsChecker";
import { StartAddressChecker } from "./checkers/StartAddressChecker";
import { Client } from "./client";
import { PlayerHostClient } from "./generated/player_grpc_pb";
import { EmptyRequest, ServerUpdateMessage } from "./generated/player_pb";
import { MainStrategy } from "./strategies/MainStrategy";
import { ActionRejecter } from "./strategy";
import { isDefined } from "./util";

function createRpcClient(): RpcClient {
    const client = new PlayerHostClient(
        process.env.SNAKE_HOST ?? "localhost:5168",
        grpc.credentials.createInsecure()
    );

    console.log("Subscribing...");

    const serverEvents = client.subscribeToServerEvents(new EmptyRequest());
    serverEvents.on("event", function (thing: ServerUpdateMessage) {
        console.log("event", thing.toObject());
    });

    console.log("Subscribed");
    return new RpcClient(client);
}

let myClient: Client;
switch (process.env.SNAKE_PROTOCOL) {
    case "grpc": {
        myClient = createRpcClient();
        break;
    }
    default:
        console.error(
            "Missing or invalid 'SNAKE_PROTOCOL'. Expected 'grpc' or 'ws'."
        );
        process.exit(1);
}

//const PLAYER_NAME = `ForTheWin_${random(0, 0xffff).toString(16)}`;
const PLAYER_NAME = process.env.SNAKE_PLAYER ?? "ForTheWin";

async function main() {
    await writeFile("./state.txt", "BOOT");
    const gameSettings = await myClient.register(PLAYER_NAME);
    console.log("gameSettings", gameSettings);
    const gameState = new GameState(
        gameSettings.dimensions,
        gameSettings.startAddress,
        PLAYER_NAME,
        gameSettings.gameStarted
    );
    const initialGameState = await myClient.getGameState();
    gameState.setState(initialGameState);
    const strategy = new MainStrategy(gameState);
    const actionRejecters = [
        new ActionRejecter([
            new StartAddressChecker(),
            new ExistingCellsCollisionChecker(),
        ]),
        new NextActionCollisionActionsChecker(),
    ];
    if (!gameState.running) {
        console.log("WAITING FOR START");
    }

    const gameUpdates = myClient.subscribe();
    let lastFoodLogged: number = 0;
    let tickCount = 0;
    for await (const update of gameUpdates) {
        // console.debug("loop");
        if (!gameState.running) {
            console.log("STARTED");
            gameState.run();
        }
        // console.log("update", update.updatedcellsList);
        if (update.removedSnakes.length > 0) {
            console.log("removedSnakes", update.removedSnakes);
        }
        gameState.update(update);
        // const snakeAdminValidationErrors = gameState.validateSnakes();
        // if (snakeAdminValidationErrors.length > 0) {
        //     console.warn(
        //         "Snake administration incorrect: ",
        //         snakeAdminValidationErrors.join("\n")
        //     );
        // }

        if (gameState.snakes.length === 0) {
            console.error("NO SNAKES LEFT");
            process.exit(2);
        }
        if (gameState.foodManager.foods.size === 0) {
            console.error("NO FOOD LEFT");
            process.exit(0);
        }
        if (gameState.foodManager.foods.size !== lastFoodLogged) {
            lastFoodLogged = gameState.foodManager.foods.size;
            console.log("Food available", lastFoodLogged);
        }
        const actions = strategy.update();
        const actionRejections = actionRejecters.flatMap((rejecter) =>
            rejecter.check(gameState, actions)
        );

        if (actionRejections.length > 0) {
            for (const { action, reason } of actionRejections) {
                console.warn("rejectAction", action, reason);
            }
        }
        const filteredActions = actions.filter(
            (action) =>
                !actionRejections.some(
                    (rejection) => rejection.action === action
                )
        );
        gameState.applyActions(filteredActions);
        for (const action of filteredActions) {
            switch (action.type) {
                case ActionType.Move:
                    {
                        //gameState
                        //    .getSnake(action.snakeName)
                        //    ?.log(`move`, action.nextLocation);
                        await myClient.moveSnake(action);
                    }
                    break;
                case ActionType.Split:
                    {
                        gameState
                            .getSnake(action.oldSnakeName)
                            ?.log(
                                `split to ${action.newSnakeName}:${action.snakeSegment}`, action.nextLocation
                            );
                        await myClient.splitSnake(action);
                    }
                    break;
            }
        }

        // Send special 'player is done' move
        // const action : Action = {
        //     type: ActionType.Move,
        //     snakeName: "",
        //     nextLocation: []
        // };
        // await myClient.moveSnake(action);

        const snakesWithMoves = new Set(
            filteredActions
                .map(
                    (action) =>
                        (action.type === ActionType.Move && action.snakeName) ||
                        undefined
                )
                .filter(isDefined)
        );
        const missingSnakesMoves = new Set(
            gameState.snakes.filter((snake) => !snakesWithMoves.has(snake.name))
        );
        const strategyText = strategy.inspect();
        const overallText = [
            `tick=${tickCount++}`,
            `food=${gameState.foodManager.foods.size}`,
            `running=${gameState.running}`,
            `savedSnakes=${gameState.savedSnakes}`,
            `stuckSnakes=${[...missingSnakesMoves]
                .map((snake) => snake.name)
                .join(", ")}`,
            "",
        ];
        await writeFile(
            "./state.txt",
            [...overallText, strategyText, ""].join("\n")
        );
    }
}

main().catch((err) => {
    console.error("FATAL", err);
    process.exit(1);
});
