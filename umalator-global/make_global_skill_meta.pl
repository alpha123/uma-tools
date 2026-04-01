use strict;
use warnings;
use v5.012;

use DBI;
use DBD::SQLite::Constants qw(:file_open);
use JSON::PP;

if (!@ARGV) {
	die 'Usage: make_global_skill_meta.pl master.mdb';
}

my $mastermdb = shift @ARGV;

my $db = DBI->connect("dbi:SQLite:$mastermdb", undef, undef, {
	sqlite_open_flags => SQLITE_OPEN_READONLY
});
$db->{RaiseError} = 1;

my $select = $db->prepare(<<SQL
   SELECT s.id, s.group_id, s.icon_id, COALESCE(sp.need_skill_point,0),
          s.tag_id, s.grade_value, s.disp_order
     FROM skill_data s
LEFT JOIN single_mode_skill_need_point sp
       ON s.id = sp.id
    WHERE s.is_general_skill = 1 OR s.rarity >= 3;
SQL
);

$select->execute;

$select->bind_columns(\my ($id, $group_id, $icon_id, $sp_cost, $tag_id, $grade_value, $disp_order));

my $skills = {};
while ($select->fetch) {
	if ($group_id >= 1000 && $group_id < 2000) {  # put 1★/2★ uniques in the same group as their 3★ versions
		$group_id += 9000;
	}
	$skills->{$id} = {
		groupId => "$group_id",
		iconId => "$icon_id",
		baseCost => $sp_cost,
		score => $grade_value,
		tags => [map { $_ + 0 } split('/', $tag_id)],
		order => $disp_order
	};
}

my $json = JSON::PP->new;
$json->canonical(1);
say $json->encode($skills);
