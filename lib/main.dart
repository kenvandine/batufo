import 'package:batufo/engine/ui/game_widget.dart';
import 'package:batufo/engine/ui/images.dart';
import 'package:batufo/engine/world_position.dart';
import 'package:batufo/game/ui/batufo_game.dart';
import 'package:batufo/game_props.dart';
import 'package:batufo/grpc/client.dart';
import 'package:batufo/inputs/gestures.dart';
import 'package:batufo/models/game_model.dart';
import 'package:flutter/material.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Images.instance.load([
    GameProps.assets.floorTiles.imagePath,
    GameProps.assets.player.imagePath,
    GameProps.assets.thrust.imagePath,
    GameProps.assets.wallMetal.imagePath,
    GameProps.assets.bulletExplosion.imagePath,
  ]);
  const level = 'simple';
  final client = await Client.create(level);

  WorldPosition.tileSize = GameProps.tileSize;
  final gameModel = client.arena.initGameModel();
  final game = BatufoGame(gameModel);
  runApp(MyApp(
    game: game,
    gameModel: gameModel,
  ));
}

class MyApp extends StatelessWidget {
  final BatufoGame game;
  final GameModel gameModel;
  const MyApp({@required this.game, this.gameModel});

  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        body: Stack(children: [
          GestureDetector(
            onPanUpdate: GameGestures.instance.onPanUpdate,
            child: GameWidget(
              game,
              background: Colors.tealAccent,
            ),
          ),
          /*
          StreamBuilder(
            stream: gameModel.stats.update$,
            builder: (_, AsyncSnapshot<StatsModel> snapshot) =>
                HudWidget(model: snapshot.data),
            initialData: gameModel.stats,
          )
           */
        ]),
      ),
    );
  }
}